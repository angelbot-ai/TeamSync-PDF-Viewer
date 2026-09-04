import { describe, it, expect } from 'vitest';
import {
  estimatePageDimensions,
  computeRowLayout,
  hasDimensionMismatch,
  DEFAULT_FALLBACK_DIMS,
} from './layoutUtils';

describe('layoutUtils', () => {
  describe('estimatePageDimensions', () => {
    it('returns empty array when numPages <= 0', () => {
      expect(estimatePageDimensions(0)).toEqual([]);
      expect(estimatePageDimensions(-5)).toEqual([]);
    });

    it('pre-allocates estimated space for all pages using sample dimension', () => {
      const sample = { width: 500, height: 700 };
      const dims = estimatePageDimensions(5, sample);
      expect(dims).toHaveLength(5);
      expect(dims[0]).toEqual({ width: 500, height: 700 });
      expect(dims[4]).toEqual({ width: 500, height: 700 });
    });

    it('falls back to DEFAULT_FALLBACK_DIMS when no sample provided', () => {
      const dims = estimatePageDimensions(3);
      expect(dims).toHaveLength(3);
      expect(dims[0]).toEqual(DEFAULT_FALLBACK_DIMS);
    });
  });

  describe('computeRowLayout', () => {
    it('computes correct tops and total for single-page rows', () => {
      const rows = [[1], [2], [3]];
      const dimsFor = (p: number) => ({ width: 600, height: p === 2 ? 800 : 700 });
      const scale = 1.0;
      const gap = 16;

      const layout = computeRowLayout(rows, dimsFor, scale, gap);
      // Row 0: height = 700 + 16 = 716, top = 0
      // Row 1: height = 800 + 16 = 816, top = 716
      // Row 2: height = 700 + 16 = 716, top = 1532
      expect(layout.heights).toEqual([716, 816, 716]);
      expect(layout.tops).toEqual([0, 716, 1532]);
      expect(layout.total).toBe(716 + 816 + 716);
    });

    it('computes correct row layout for multi-page rows (e.g. facing/double)', () => {
      const rows = [[1], [2, 3]];
      const dimsFor = (p: number) => {
        if (p === 2) return { width: 600, height: 900 };
        return { width: 600, height: 800 };
      };
      const scale = 2.0;
      const gap = 20;

      const layout = computeRowLayout(rows, dimsFor, scale, gap);
      // Row 0: height = 800 * 2 + 20 = 1620, top = 0
      // Row 1: max(900, 800) * 2 + 20 = 1820, top = 1620
      expect(layout.heights).toEqual([1620, 1820]);
      expect(layout.tops).toEqual([0, 1620]);
      expect(layout.total).toBe(3440);
    });
  });

  describe('hasDimensionMismatch', () => {
    it('returns false when dimensions match within tolerance', () => {
      const a = [{ width: 612, height: 792 }, { width: 612, height: 792 }];
      const b = [{ width: 612.2, height: 792.1 }, { width: 612, height: 792 }];
      expect(hasDimensionMismatch(a, b, 0.5)).toBe(false);
    });

    it('returns true when dimensions differ beyond tolerance', () => {
      const a = [{ width: 612, height: 792 }, { width: 612, height: 792 }];
      const b = [{ width: 612, height: 792 }, { width: 792, height: 612 }]; // page 2 is landscape
      expect(hasDimensionMismatch(a, b)).toBe(true);
    });

    it('returns true when lengths differ', () => {
      const a = [{ width: 612, height: 792 }];
      const b = [{ width: 612, height: 792 }, { width: 612, height: 792 }];
      expect(hasDimensionMismatch(a, b)).toBe(true);
    });
  });
});
