/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Page geometry — the single authority for converting between the viewer's "base page space"
 * (pdf.js viewport at scale 1 with the page's intrinsic /Rotate applied; top-left origin, points)
 * and PDF user space (bottom-left origin, as written into XFDF / drawn by pdf-lib).
 *
 * The transform replicates pdf.js `PageViewport` exactly (display_utils.js) so results are
 * identical to `viewport.convertToPdfPoint` / `convertToViewportPoint`, but it only needs the
 * page's `view` (viewBox) and `rotate`, which keeps it synchronous and unit-testable.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { normalizeRotation } from '../utils/rotationUtils';

export type Matrix = [number, number, number, number, number, number];

export interface PageGeometry {
  /** 1-based page number */
  pageNumber: number;
  /** PDF user-space bounding box [x0, y0, x1, y1] (the CropBox pdf.js renders). */
  viewBox: [number, number, number, number];
  /** Intrinsic page rotation (/Rotate), normalized to 0/90/180/270. */
  rotate: number;
  /** Base page size in points (already swapped for 90/270). */
  width: number;
  height: number;
  /** Base-space (viewer) -> PDF user-space transform is the inverse of this viewport transform. */
  transform: Matrix;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** PDF rectangle as XFDF writes it: [llx, lly, urx, ury]. */
export type PdfRect = [number, number, number, number];

/** Collapse -0 to 0 so equality checks and XFDF output never see a signed zero. */
const z = (n: number): number => (n === 0 ? 0 : n);

function applyTransform(p: Point, m: Matrix): Point {
  return { x: z(p.x * m[0] + p.y * m[2] + m[4]), y: z(p.x * m[1] + p.y * m[3] + m[5]) };
}

function applyInverseTransform(p: Point, m: Matrix): Point {
  const d = m[0] * m[3] - m[1] * m[2];
  return {
    x: z((p.x * m[3] - p.y * m[2] + m[2] * m[5] - m[4] * m[3]) / d),
    y: z((-p.x * m[1] + p.y * m[0] + m[4] * m[1] - m[5] * m[0]) / d),
  };
}

/** Build the geometry for a page from its viewBox and intrinsic rotation (mirrors pdf.js PageViewport at scale 1). */
export function createPageGeometry(pageNumber: number, viewBox: [number, number, number, number], rotate: number): PageGeometry {
  const rotation = normalizeRotation(rotate);
  const [x0, y0, x1, y1] = viewBox;
  const centerX = (x1 + x0) / 2;
  const centerY = (y1 + y0) / 2;

  let rotateA: number, rotateB: number, rotateC: number, rotateD: number;
  switch (rotation) {
    case 180: rotateA = -1; rotateB = 0; rotateC = 0; rotateD = 1; break;
    case 90: rotateA = 0; rotateB = 1; rotateC = 1; rotateD = 0; break;
    case 270: rotateA = 0; rotateB = -1; rotateC = -1; rotateD = 0; break;
    default: rotateA = 1; rotateB = 0; rotateC = 0; rotateD = -1; break;
  }

  let offsetCanvasX: number, offsetCanvasY: number, width: number, height: number;
  if (rotateA === 0) {
    offsetCanvasX = Math.abs(centerY - y0);
    offsetCanvasY = Math.abs(centerX - x0);
    width = Math.abs(y1 - y0);
    height = Math.abs(x1 - x0);
  } else {
    offsetCanvasX = Math.abs(centerX - x0);
    offsetCanvasY = Math.abs(centerY - y0);
    width = x1 - x0;
    height = y1 - y0;
  }

  const transform: Matrix = [
    rotateA, rotateB, rotateC, rotateD,
    offsetCanvasX - rotateA * centerX - rotateC * centerY,
    offsetCanvasY - rotateB * centerX - rotateD * centerY,
  ];

  return { pageNumber, viewBox: [x0, y0, x1, y1], rotate: rotation, width, height, transform };
}

export function geometryFromPage(page: PDFPageProxy): PageGeometry {
  const view = page.view as number[];
  return createPageGeometry(page.pageNumber, [view[0], view[1], view[2], view[3]], page.rotate);
}

/** Small per-document cache so callers can resolve geometry for many annotations cheaply. */
export function createGeometryResolver(pdfDoc: PDFDocumentProxy) {
  const cache = new Map<number, Promise<PageGeometry>>();
  return (pageNumber: number): Promise<PageGeometry> => {
    const n = Math.max(1, Math.min(pdfDoc.numPages, pageNumber));
    let p = cache.get(n);
    if (!p) {
      p = pdfDoc.getPage(n).then(geometryFromPage);
      cache.set(n, p);
    }
    return p;
  };
}

export type GeometryResolver = (pageNumber: number) => Promise<PageGeometry>;

// ---- point / rect / path conversions ----------------------------------------------------------

export function toPdfPoint(g: PageGeometry, p: Point): Point {
  return applyInverseTransform(p, g.transform);
}

export function fromPdfPoint(g: PageGeometry, p: Point): Point {
  return applyTransform(p, g.transform);
}

/** Viewer rect (top-left origin) -> PDF rect [llx, lly, urx, ury]. */
export function rectToPdf(g: PageGeometry, r: Rect): PdfRect {
  const a = toPdfPoint(g, { x: r.x, y: r.y });
  const b = toPdfPoint(g, { x: r.x + r.width, y: r.y + r.height });
  return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
}

/** PDF rect [llx, lly, urx, ury] -> viewer rect (top-left origin). */
export function rectFromPdf(g: PageGeometry, r: PdfRect): Rect {
  const a = fromPdfPoint(g, { x: r[0], y: r[1] });
  const b = fromPdfPoint(g, { x: r[2], y: r[3] });
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function pathToPdf(g: PageGeometry, points: Point[]): Point[] {
  return points.map((p) => toPdfPoint(g, p));
}

export function pathFromPdf(g: PageGeometry, points: Point[]): Point[] {
  return points.map((p) => fromPdfPoint(g, p));
}

/**
 * XFDF QuadPoints for a viewer rect: x1,y1 (upper-left) x2,y2 (upper-right) x3,y3 (lower-left)
 * x4,y4 (lower-right) in PDF space — the order Acrobat and Apryse write for text markup.
 */
export function rectToQuadPoints(g: PageGeometry, r: Rect): number[] {
  const [llx, lly, urx, ury] = rectToPdf(g, r);
  return [llx, ury, urx, ury, llx, lly, urx, lly];
}

/** Bounding viewer rect of one or more XFDF quads (8 numbers each). */
export function quadPointsToRects(g: PageGeometry, quads: number[]): Rect[] {
  const rects: Rect[] = [];
  for (let i = 0; i + 7 < quads.length; i += 8) {
    const xs = [quads[i], quads[i + 2], quads[i + 4], quads[i + 6]];
    const ys = [quads[i + 1], quads[i + 3], quads[i + 5], quads[i + 7]];
    rects.push(rectFromPdf(g, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]));
  }
  return rects;
}

export function unionRects(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Round to 3 decimals for XFDF output (Apryse writes 3, Acrobat up to 6). */
export const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString();
