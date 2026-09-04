import { describe, expect, it } from 'vitest';
import {
  calculateNextZoomIn,
  calculateNextZoomOut,
  clampScale,
  calculateSafeRenderScale,
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
      expect(calculateNextZoomIn(8.0)).toBe(9.0);
      expect(calculateNextZoomIn(9.5)).toBe(10.0);
    });

    it('clamps to MAX_SCALE', () => {
      expect(calculateNextZoomIn(MAX_SCALE)).toBe(MAX_SCALE);
      expect(calculateNextZoomIn(9.8)).toBe(MAX_SCALE);
    });
  });

  describe('calculateNextZoomOut', () => {
    it('steps by 1.0 when scale > 5', () => {
      expect(calculateNextZoomOut(10.0)).toBe(9.0);
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

    it('clamps renderScale at 1000% zoom to safe hardware dimensions and pixel limits', () => {
      // 612x792 pt page at 1000% zoom on 2x retina
      const uncappedScale = 10.0 * 2.0; // 20.0
      // 612 * 20 = 12,240 px, 792 * 20 = 15,840 px (would be 193 MP, exceeding maxDim and maxPixels!)
      const renderScale = calculateSafeRenderScale(10.0, 2.0, 612, 792, MAX_CANVAS_DIM, MAX_CANVAS_PIXELS);
      expect(renderScale).toBeLessThan(uncappedScale);

      const clampedW = 612 * renderScale;
      const clampedH = 792 * renderScale;

      expect(clampedW).toBeLessThanOrEqual(MAX_CANVAS_DIM);
      expect(clampedH).toBeLessThanOrEqual(MAX_CANVAS_DIM);
      expect(clampedW * clampedH).toBeLessThanOrEqual(MAX_CANVAS_PIXELS + 1); // floating point tolerance
    });

    it('clamps to mobile max dimension (4096px) when specified', () => {
      const mobileMaxDim = 4096;
      const renderScale = calculateSafeRenderScale(10.0, 2.0, 612, 792, mobileMaxDim, MAX_CANVAS_PIXELS);
      const clampedW = 612 * renderScale;
      const clampedH = 792 * renderScale;
      expect(clampedW).toBeLessThanOrEqual(mobileMaxDim);
      expect(clampedH).toBeLessThanOrEqual(mobileMaxDim);
    });
  });
});
