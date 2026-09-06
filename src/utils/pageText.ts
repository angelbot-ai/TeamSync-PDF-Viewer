/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Shared page text builder and coordinate interpolator for PDF search and redaction.
 */
import type { SearchBounds } from '../core/types';

export interface PageText {
  fullText: string;
  itemIndices: number[];
  charIndices: number[];
  normText: string;
  normToRaw: number[];
}

/**
 * Collapses any consecutive whitespace runs to a single space and trims edges.
 */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Builds raw page text with item/char index source-mapping, followed by a second pass
 * creating normalized text (collapsing any maximal whitespace run to a single space)
 * and a 1-to-1 index map back to raw string indices.
 */
export function buildPageText(items: any[]): PageText {
  let fullText = '';
  const itemIndices: number[] = [];
  const charIndices: number[] = [];

  // Pass 1: Build raw fullText with item and char index sentinels
  items.forEach((item, index) => {
    const str = item.str ?? '';
    for (let i = 0; i < str.length; i++) {
      itemIndices.push(index);
      charIndices.push(i);
    }
    fullText += str;

    if (item.hasEOL) {
      fullText += '\n';
      itemIndices.push(-1);
      charIndices.push(-1);
    } else {
      fullText += ' ';
      itemIndices.push(-1);
      charIndices.push(-1);
    }
  });

  // Pass 2: Collapse maximal runs of /\s/ into a single ' ' pointing to the run's first raw index
  let normText = '';
  const normToRaw: number[] = [];

  let i = 0;
  while (i < fullText.length) {
    const char = fullText[i];
    if (/\s/.test(char)) {
      const runStart = i;
      while (i < fullText.length && /\s/.test(fullText[i])) {
        i++;
      }
      normText += ' ';
      normToRaw.push(runStart);
    } else {
      normText += char;
      normToRaw.push(i);
      i++;
    }
  }

  return {
    fullText,
    itemIndices,
    charIndices,
    normText,
    normToRaw,
  };
}

/**
 * Computes bounding boxes in PDF coordinate points for a matched range [rawStart, rawEndExcl) in fullText.
 * Separator sentinels (-1) are skipped, and character positions are interpolated across each TextItem.
 */
export function boundsForRawRange(
  items: any[],
  pageText: Pick<PageText, 'itemIndices' | 'charIndices'>,
  rawStart: number,
  rawEndExcl: number
): SearchBounds[] {
  const { itemIndices, charIndices } = pageText;
  const itemMatches = new Map<number, { min: number; max: number }>();

  for (let i = rawStart; i < rawEndExcl; i++) {
    const itemIdx = itemIndices[i];
    const charIdx = charIndices[i];
    if (itemIdx !== undefined && itemIdx !== -1) {
      const existing = itemMatches.get(itemIdx);
      if (existing) {
        existing.min = Math.min(existing.min, charIdx);
        existing.max = Math.max(existing.max, charIdx);
      } else {
        itemMatches.set(itemIdx, { min: charIdx, max: charIdx });
      }
    }
  }

  const bounds: SearchBounds[] = [];

  itemMatches.forEach((match, itemIndex) => {
    const item = items[itemIndex];
    if (!item || !item.transform) return;

    const x = item.transform[4];
    const y = item.transform[5];
    const width = item.width;
    const height = item.height || Math.abs(item.transform[3]);
    const strLen = (item.str ?? '').length;

    if (strLen > 0) {
      const charWidth = width / strLen;
      const startX = x + match.min * charWidth;
      const matchWidth = (match.max - match.min + 1) * charWidth;
      bounds.push({ x: startX, y, width: matchWidth, height });
    } else {
      bounds.push({ x, y, width, height });
    }
  });

  return bounds;
}
