/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import type * as pdfjsLib from 'pdfjs-dist';
import type { TextDiffSegment, DiffItem, DiffBoundingBox } from '../types/compare';

export interface PageDiffResult {
  diffsA: DiffBoundingBox[];
  diffsB: DiffBoundingBox[];
  summary: DiffItem[];
}

export interface WordToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts individual words with precise unscaled viewport bounding boxes from a PDF.js page.
 */
export async function extractWordsFromPage(page: pdfjsLib.PDFPageProxy): Promise<WordToken[]> {
  const vp = page.getViewport({ scale: 1, rotation: page.rotate });
  const textContent = await page.getTextContent();
  const wordTokens: WordToken[] = [];

  for (const item of textContent.items as any[]) {
    if (!item.str || typeof item.str !== 'string') continue;
    const str = item.str;
    if (str.trim().length === 0) continue;

    const tx = item.transform[4];
    const ty = item.transform[5];
    const itemWidth = item.width || 0;
    const fontSize = Math.sqrt((item.transform[0] || 0) ** 2 + (item.transform[1] || 0) ** 2) || 12;
    const itemHeight = item.height || fontSize;

    const [vx1, vy1] = vp.convertToViewportPoint(tx, ty + itemHeight);
    const [vx2, vy2] = vp.convertToViewportPoint(tx + itemWidth, ty);

    const itemX = Math.min(vx1, vx2);
    const itemY = Math.min(vy1, vy2);
    const itemW = Math.max(Math.abs(vx2 - vx1), 4);
    const itemH = Math.max(Math.abs(vy2 - vy1), 8);

    const parts = str.split(/(\s+)/);
    let offset = 0;
    const totalChars = str.length || 1;

    for (const p of parts) {
      const charRatio = p.length / totalChars;
      const wWidth = itemW * charRatio;
      const wX = itemX + (offset / totalChars) * itemW;
      offset += p.length;

      if (p.trim().length > 0) {
        wordTokens.push({
          text: p.trim(),
          x: wX,
          y: itemY,
          width: Math.max(wWidth, 6),
          height: itemH
        });
      }
    }
  }

  return wordTokens;
}

/**
 * Computes exact text difference bounding boxes on a page for both Document A and Document B.
 */
export async function computePageDiffBoxes(
  pdfDocA: pdfjsLib.PDFDocumentProxy,
  pdfDocB: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<PageDiffResult> {
  const [pageA, pageB] = await Promise.all([
    pdfDocA.getPage(pageIndex),
    pdfDocB.getPage(Math.min(pageIndex, pdfDocB.numPages))
  ]);

  const [wordsA, wordsB] = await Promise.all([
    extractWordsFromPage(pageA),
    extractWordsFromPage(pageB)
  ]);

  const textArrA = wordsA.map(w => w.text);
  const textArrB = wordsB.map(w => w.text);

  // Myers diff on word tokens
  const n = textArrA.length;
  const m = textArrB.length;
  const max = n + m;
  const v = new Int32Array(2 * max + 1);
  v[1] = 0;
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < n && y < m && textArrA[x] === textArrB[y]) {
        x++;
        y++;
      }
      v[k + max] = x;
      if (x >= n && y >= m) {
        break;
      }
    }
    if (v[n - m + max] >= n && (v[n - m + max] - (n - m)) >= m) break;
  }

  // Backtrack
  let x = n;
  let y = m;
  const delIndicesA: number[] = [];
  const addIndicesB: number[] = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const vArr = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vArr[k - 1 + max] < vArr[k + 1 + max])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vArr[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        addIndicesB.push(y - 1);
        y--;
      } else if (y === prevY) {
        delIndicesA.push(x - 1);
        x--;
      }
    }
  }

  delIndicesA.reverse();
  addIndicesB.reverse();

  const diffsA = groupWordsIntoBoxes(delIndicesA.map(i => wordsA[i]), pageIndex, 'deletion');
  const diffsB = groupWordsIntoBoxes(addIndicesB.map(i => wordsB[i]), pageIndex, 'addition');

  const summary: DiffItem[] = [];
  for (const d of diffsA) {
    summary.push({
      id: d.id,
      pageIndex,
      type: 'deletion',
      description: `Removed "${d.text.length > 40 ? d.text.slice(0, 40) + '...' : d.text}"`,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height
    });
  }
  for (const a of diffsB) {
    summary.push({
      id: a.id,
      pageIndex,
      type: 'addition',
      description: `Added "${a.text.length > 40 ? a.text.slice(0, 40) + '...' : a.text}"`,
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height
    });
  }

  return { diffsA, diffsB, summary };
}

function groupWordsIntoBoxes(words: WordToken[], pageIndex: number, type: 'addition' | 'deletion' | 'modification'): DiffBoundingBox[] {
  if (words.length === 0) return [];
  const boxes: DiffBoundingBox[] = [];

  let currentWords: WordToken[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const prev = currentWords[currentWords.length - 1];
    const curr = words[i];

    const sameLine = Math.abs(curr.y - prev.y) < Math.max(prev.height, curr.height) * 0.6;
    const nearby = curr.x - (prev.x + prev.width) < 30;

    if (sameLine && nearby) {
      currentWords.push(curr);
    } else {
      boxes.push(createBoxFromTokens(currentWords, pageIndex, type, boxes.length + 1));
      currentWords = [curr];
    }
  }

  if (currentWords.length > 0) {
    boxes.push(createBoxFromTokens(currentWords, pageIndex, type, boxes.length + 1));
  }

  return boxes;
}

function createBoxFromTokens(tokens: WordToken[], pageIndex: number, type: 'addition' | 'deletion' | 'modification', seq: number): DiffBoundingBox {
  const minX = Math.min(...tokens.map(t => t.x));
  const minY = Math.min(...tokens.map(t => t.y));
  const maxX = Math.max(...tokens.map(t => t.x + t.width));
  const maxY = Math.max(...tokens.map(t => t.y + t.height));
  const text = tokens.map(t => t.text).join(' ');

  return {
    id: `diff-box-${pageIndex}-${type}-${seq}-${Math.round(minX)}-${Math.round(minY)}`,
    pageIndex,
    type,
    text,
    x: Math.max(0, minX - 2),
    y: Math.max(0, minY - 1),
    width: maxX - minX + 4,
    height: maxY - minY + 2
  };
}

/**
 * Lightweight client-side Myers Diff algorithm for raw text comparison.
 */
export function computeTextDiff(textA: string, textB: string, pageIndex: number): TextDiffSegment[] {
  const wordsA = textA.split(/(\s+)/);
  const wordsB = textB.split(/(\s+)/);

  const n = wordsA.length;
  const m = wordsB.length;
  const max = n + m;
  const v = new Int32Array(2 * max + 1);
  v[1] = 0;

  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < n && y < m && wordsA[x] === wordsB[y]) {
        x++;
        y++;
      }
      v[k + max] = x;
      if (x >= n && y >= m) {
        return buildDiffResult(trace, wordsA, wordsB, pageIndex);
      }
    }
  }

  return [
    { type: 'delete', text: textA, pageIndex },
    { type: 'add', text: textB, pageIndex }
  ];
}

function buildDiffResult(trace: Int32Array[], wordsA: string[], wordsB: string[], pageIndex: number): TextDiffSegment[] {
  let x = wordsA.length;
  let y = wordsB.length;
  const max = wordsA.length + wordsB.length;
  const rawResult: { type: 'equal' | 'add' | 'delete'; text: string }[] = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      rawResult.push({ type: 'equal', text: wordsA[x - 1] });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        rawResult.push({ type: 'add', text: wordsB[y - 1] });
        y--;
      } else if (y === prevY) {
        rawResult.push({ type: 'delete', text: wordsA[x - 1] });
        x--;
      }
    }
  }

  rawResult.reverse();

  const consolidated: TextDiffSegment[] = [];
  for (const item of rawResult) {
    if (consolidated.length > 0 && consolidated[consolidated.length - 1].type === item.type) {
      consolidated[consolidated.length - 1].text += item.text;
    } else {
      consolidated.push({ ...item, pageIndex });
    }
  }

  return consolidated;
}

/**
 * Colorizes a rendered page canvas with a custom hex tint.
 */
export function tintCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, colorHex: string, opacity: number = 0.75) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = colorHex;
  ctx.globalAlpha = opacity;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Computes pixel-level difference bounding boxes between two rendered page canvases.
 */
export function computeCanvasPixelDiff(
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement,
  pageIndex: number,
  scale: number
): DiffItem[] {
  const width = Math.min(canvasA.width, canvasB.width);
  const height = Math.min(canvasA.height, canvasB.height);
  if (width === 0 || height === 0) return [];

  const ctxA = canvasA.getContext('2d');
  const ctxB = canvasB.getContext('2d');
  if (!ctxA || !ctxB) return [];

  const imgDataA = ctxA.getImageData(0, 0, width, height);
  const imgDataB = ctxB.getImageData(0, 0, width, height);
  const dataA = imgDataA.data;
  const dataB = imgDataB.data;

  const diffItems: DiffItem[] = [];
  const GRID_SIZE = 32;
  const threshold = 30;

  for (let gy = 0; gy < height; gy += GRID_SIZE) {
    for (let gx = 0; gx < width; gx += GRID_SIZE) {
      let diffPixels = 0;
      const cellW = Math.min(GRID_SIZE, width - gx);
      const cellH = Math.min(GRID_SIZE, height - gy);

      for (let y = gy; y < gy + cellH; y += 4) {
        for (let x = gx; x < gx + cellW; x += 4) {
          const idx = (y * width + x) * 4;
          const dr = Math.abs(dataA[idx] - dataB[idx]);
          const dg = Math.abs(dataA[idx + 1] - dataB[idx + 1]);
          const db = Math.abs(dataA[idx + 2] - dataB[idx + 2]);

          if (dr + dg + db > threshold) {
            diffPixels++;
          }
        }
      }

      if (diffPixels > 3) {
        diffItems.push({
          id: `diff-${pageIndex}-${gx}-${gy}`,
          pageIndex,
          type: 'modification',
          description: `Visual difference detected at Page ${pageIndex} (${Math.round(gx / scale)}px, ${Math.round(gy / scale)}px)`,
          x: gx / scale,
          y: gy / scale,
          width: cellW / scale,
          height: cellH / scale
        });
      }
    }
  }

  return diffItems;
}

