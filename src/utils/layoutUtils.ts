/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

export interface PageDimension {
  width: number;
  height: number;
}

export interface RowLayout {
  heights: number[];
  tops: number[];
  total: number;
}

/** Standard US Letter dimensions in PDF points (72 points/inch: 8.5 x 11 inches). */
export const DEFAULT_FALLBACK_DIMS: PageDimension = { width: 612, height: 792 };

/**
 * Pre-allocates an array of page dimensions for the entire document up front,
 * reserving estimated space based on a sample page (e.g. Page 1).
 */
export function estimatePageDimensions(
  numPages: number,
  sampleDim: PageDimension = DEFAULT_FALLBACK_DIMS
): PageDimension[] {
  if (numPages <= 0) return [];
  const dim = { width: sampleDim.width, height: sampleDim.height };
  return Array.from({ length: numPages }, () => ({ ...dim }));
}

/**
 * Computes row heights, vertical tops, and total container scroll height
 * for given rows of pages and scale.
 */
export function computeRowLayout(
  rows: number[][],
  dimsFor: (page: number) => PageDimension,
  scale: number,
  gap = 16
): RowLayout {
  const heights = rows.map((row) => {
    if (row.length === 0) return gap;
    const maxHeight = Math.max(...row.map((p) => dimsFor(p).height));
    return maxHeight * scale + gap;
  });

  const tops: number[] = [];
  let acc = 0;
  for (const h of heights) {
    tops.push(acc);
    acc += h;
  }

  return { heights, tops, total: acc };
}

/**
 * Checks if any page dimension in array A differs from array B beyond a tolerance.
 */
export function hasDimensionMismatch(
  dimsA: PageDimension[],
  dimsB: PageDimension[],
  tolerance = 0.5
): boolean {
  if (dimsA.length !== dimsB.length) return true;
  for (let i = 0; i < dimsA.length; i++) {
    const a = dimsA[i];
    const b = dimsB[i];
    if (
      Math.abs(a.width - b.width) > tolerance ||
      Math.abs(a.height - b.height) > tolerance
    ) {
      return true;
    }
  }
  return false;
}
