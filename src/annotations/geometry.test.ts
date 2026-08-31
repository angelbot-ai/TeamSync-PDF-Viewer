import { describe, expect, it } from 'vitest';
import {
  createPageGeometry,
  fromPdfPoint,
  pathToPdf,
  quadPointsToRects,
  rectFromPdf,
  rectToPdf,
  rectToQuadPoints,
  toPdfPoint,
} from './geometry';

const LETTER: [number, number, number, number] = [0, 0, 612, 792];

describe('page geometry', () => {
  it('matches pdf.js for an unrotated page: y flips, x is unchanged', () => {
    const g = createPageGeometry(1, LETTER, 0);
    expect(g.width).toBe(612);
    expect(g.height).toBe(792);
    expect(toPdfPoint(g, { x: 0, y: 0 })).toEqual({ x: 0, y: 792 });
    expect(toPdfPoint(g, { x: 100, y: 50 })).toEqual({ x: 100, y: 742 });
    expect(rectToPdf(g, { x: 100, y: 50, width: 200, height: 30 })).toEqual([100, 712, 300, 742]);
  });

  it('honours a CropBox offset', () => {
    const g = createPageGeometry(1, [20, 30, 632, 822], 0);
    expect(toPdfPoint(g, { x: 0, y: 0 })).toEqual({ x: 20, y: 822 });
    expect(fromPdfPoint(g, { x: 20, y: 822 })).toEqual({ x: 0, y: 0 });
  });

  it('swaps dimensions and maps corners for /Rotate 90 and 270', () => {
    const g90 = createPageGeometry(1, LETTER, 90);
    expect(g90.width).toBe(792);
    expect(g90.height).toBe(612);
    // Viewer top-left of a page rotated 90° clockwise is the PDF lower-left corner.
    expect(toPdfPoint(g90, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toPdfPoint(g90, { x: 792, y: 612 })).toEqual({ x: 612, y: 792 });

    const g270 = createPageGeometry(1, LETTER, 270);
    expect(toPdfPoint(g270, { x: 0, y: 0 })).toEqual({ x: 612, y: 792 });
    expect(toPdfPoint(g270, { x: 792, y: 612 })).toEqual({ x: 0, y: 0 });
  });

  it('round-trips points, rects and paths for every rotation', () => {
    for (const rotate of [0, 90, 180, 270, -90, 450]) {
      const g = createPageGeometry(1, [10, 20, 622, 812], rotate);
      const rect = { x: 33.3, y: 44.4, width: 120, height: 60 };
      const back = rectFromPdf(g, rectToPdf(g, rect));
      expect(back.x).toBeCloseTo(rect.x, 6);
      expect(back.y).toBeCloseTo(rect.y, 6);
      expect(back.width).toBeCloseTo(rect.width, 6);
      expect(back.height).toBeCloseTo(rect.height, 6);

      const pts = [{ x: 1, y: 2 }, { x: 300, y: 500 }];
      const pdfPts = pathToPdf(g, pts);
      pdfPts.forEach((p, i) => {
        const v = fromPdfPoint(g, p);
        expect(v.x).toBeCloseTo(pts[i].x, 6);
        expect(v.y).toBeCloseTo(pts[i].y, 6);
      });
    }
  });

  it('writes QuadPoints in Acrobat order and reads them back', () => {
    const g = createPageGeometry(1, LETTER, 0);
    const rect = { x: 100, y: 50, width: 200, height: 30 };
    const quads = rectToQuadPoints(g, rect);
    // upper-left, upper-right, lower-left, lower-right in PDF space
    expect(quads).toEqual([100, 742, 300, 742, 100, 712, 300, 712]);
    const [back] = quadPointsToRects(g, quads);
    expect(back).toEqual(rect);
  });
});
