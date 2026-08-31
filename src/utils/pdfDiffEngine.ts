/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import type { TextDiffSegment, DiffItem } from '../types/compare';

/**
 * Lightweight client-side Myers Diff algorithm for text comparison.
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

  // Consolidate adjacent diff segments
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
 * Colorizes a rendered page canvas with a custom hex tint (e.g. Red for Doc A, Cyan for Doc B)
 * for high-contrast Overlay Diff rendering.
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
  const GRID_SIZE = 32; // Grid cell size in pixels
  const threshold = 30; // Pixel color difference sensitivity threshold

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
