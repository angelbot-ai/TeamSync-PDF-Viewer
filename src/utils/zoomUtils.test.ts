import { describe, expect, it } from 'vitest';
import {
  calculateNextZoomIn,
  calculateNextZoomOut,
  clampScale,
  calculateSafeRenderScale,
  calculateScrollCompensation,
  MAX_SCALE,
  MIN_SCALE,
  MAX_CANVAS_DIM,
  MAX_CANVAS_PIXELS
} from './zoomUtils';

describe('zoomUtils', () => {
  describe('calculateNextZoomIn', () => {
    it('steps by 0.25 when scale < 2', () => {
      expect(calculateNextZoomIn(1.0)).toBe(1.25);
      expect(calculateNextZoomIn(1.25)).toBe(1.5);
      expect(calculateNextZoomIn(1.75)).toBe(2.0);
    });

    it('steps by 0.5 when 2 <= scale < 5', () => {
      expect(calculateNextZoomIn(2.0)).toBe(2.5);
      expect(calculateNextZoomIn(3.0)).toBe(3.5);
      expect(calculateNextZoomIn(4.5)).toBe(5.0);
    });

    it('steps by 1.0 when scale >= 5', () => {
      expect(calculateNextZoomIn(5.0)).toBe(6.0);
      expect(calculateNextZoomIn(6.0)).toBe(7.0);
      expect(calculateNextZoomIn(7.0)).toBe(8.0);
    });

    it('clamps to MAX_SCALE', () => {
      expect(calculateNextZoomIn(MAX_SCALE)).toBe(MAX_SCALE);
      expect(calculateNextZoomIn(7.8)).toBe(MAX_SCALE);
    });
  });

  describe('calculateNextZoomOut', () => {
    it('steps by 1.0 when scale > 5', () => {
      expect(calculateNextZoomOut(8.0)).toBe(7.0);
      expect(calculateNextZoomOut(7.0)).toBe(6.0);
    });

    it('steps by 0.5 when 2 < scale <= 5', () => {
      expect(calculateNextZoomOut(5.0)).toBe(4.5);
      expect(calculateNextZoomOut(3.0)).toBe(2.5);
    });

    it('steps by 0.25 when scale <= 2', () => {
      expect(calculateNextZoomOut(2.0)).toBe(1.75);
      expect(calculateNextZoomOut(1.0)).toBe(0.75);
      expect(calculateNextZoomOut(0.5)).toBe(0.25);
    });

    it('clamps to MIN_SCALE', () => {
      expect(calculateNextZoomOut(MIN_SCALE)).toBe(MIN_SCALE);
      expect(calculateNextZoomOut(0.2)).toBe(MIN_SCALE);
    });
  });

  describe('clampScale', () => {
    it('clamps within MIN_SCALE and MAX_SCALE', () => {
      expect(clampScale(0.05)).toBe(MIN_SCALE);
      expect(clampScale(15.0)).toBe(MAX_SCALE);
      expect(clampScale(2.3456)).toBe(2.35);
    });
  });

  describe('calculateSafeRenderScale', () => {
    it('returns scale * outputScale when within bounds', () => {
      // 612x792 pt page at 100% zoom on 2x retina
      const renderScale = calculateSafeRenderScale(1.0, 2.0, 612, 792, MAX_CANVAS_DIM, MAX_CANVAS_PIXELS);
      expect(renderScale).toBe(2.0);
      const pixelW = 612 * renderScale;
      const pixelH = 792 * renderScale;
      expect(pixelW * pixelH).toBeLessThan(MAX_CANVAS_PIXELS);
      expect(pixelW).toBeLessThanOrEqual(MAX_CANVAS_DIM);
      expect(pixelH).toBeLessThanOrEqual(MAX_CANVAS_DIM);
    });

    it('clamps renderScale at 800% zoom to safe hardware dimensions and pixel limits', () => {
      // 612x792 pt page at 800% zoom on 2x retina
      const uncappedScale = 8.0 * 2.0; // 16.0
      // 612 * 16 = 9,792 px, 792 * 16 = 12,672 px (would be 124 MP, exceeding maxDim and maxPixels!)
      const renderScale = calculateSafeRenderScale(8.0, 2.0, 612, 792, MAX_CANVAS_DIM, MAX_CANVAS_PIXELS);
      expect(renderScale).toBeLessThan(uncappedScale);

      const clampedW = 612 * renderScale;
      const clampedH = 792 * renderScale;

      expect(clampedW).toBeLessThanOrEqual(MAX_CANVAS_DIM);
      expect(clampedH).toBeLessThanOrEqual(MAX_CANVAS_DIM);
      expect(clampedW * clampedH).toBeLessThanOrEqual(MAX_CANVAS_PIXELS + 1); // floating point tolerance
    });

    it('clamps to mobile max dimension (2048px) when specified', () => {
      const mobileMaxDim = 2048;
      const renderScale = calculateSafeRenderScale(8.0, 2.0, 612, 792, mobileMaxDim, MAX_CANVAS_PIXELS);
      const clampedW = 612 * renderScale;
      const clampedH = 792 * renderScale;
      expect(clampedW).toBeLessThanOrEqual(mobileMaxDim);
      expect(clampedH).toBeLessThanOrEqual(mobileMaxDim);
    });
  });

  describe('calculateScrollCompensation', () => {
    it('prevents view jumping on initial programmatic fit from 1.0 to 2.27 at top of document', () => {
      // Recreates the exact user scenario:
      // Seed scale: 1.0, newScale: 2.27, container: 1000x800, starting at top (scrollTop: 0)
      const res = calculateScrollCompensation({
        prevScale: 1.0,
        newScale: 2.27,
        containerWidth: 1000,
        containerHeight: 800,
        currentScrollLeft: 0,
        currentScrollTop: 0,
        basePageWidth: 612,
        isProgrammatic: true,
      });
      // MUST NOT be pushed down to 508px!
      expect(res.scrollTop).toBe(0);
      expect(res.scrollLeft).toBe(0);
    });

    it('prevents view jumping on scale change when user is at top of document (scrollTop <= 0) without focus point', () => {
      const res = calculateScrollCompensation({
        prevScale: 1.0,
        newScale: 2.27,
        containerWidth: 1000,
        containerHeight: 800,
        currentScrollLeft: 0,
        currentScrollTop: 0,
        basePageWidth: 612,
        focusPoint: null,
      });
      expect(res.scrollTop).toBe(0);
      expect(res.scrollLeft).toBe(0);
    });

    it('centers zoom around viewport center when user is scrolled down into document with toolbar zoom', () => {
      // User is reading page at scrollTop = 1000
      const res = calculateScrollCompensation({
        prevScale: 1.0,
        newScale: 1.5,
        containerWidth: 1000,
        containerHeight: 800,
        currentScrollLeft: 0,
        currentScrollTop: 1000,
        basePageWidth: 612,
        focusPoint: null,
      });
      // y = vy + scrollTop = 400 + 1000 = 1400.
      // newScrollTop = 1400 * 1.5 - 400 = 2100 - 400 = 1700.
      expect(res.scrollTop).toBe(1700);
    });

    it('centers zoom around explicit focus point during wheel zoom', () => {
      const res = calculateScrollCompensation({
        prevScale: 1.0,
        newScale: 2.0,
        containerWidth: 1000,
        containerHeight: 800,
        currentScrollLeft: 0,
        currentScrollTop: 500,
        basePageWidth: 612,
        focusPoint: { vx: 200, vy: 100 },
      });
      // y = 100 + 500 = 600.
      // newScrollTop = 600 * 2.0 - 100 = 1200 - 100 = 1100.
      expect(res.scrollTop).toBe(1100);
    });
  });
});
