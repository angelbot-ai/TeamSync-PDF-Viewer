/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * PDF export: bakes annotations + watermark into a copy of the source document and rasterizes
 * redacted pages so the underlying content is destroyed.
 *
 * The source bytes come from the already-loaded pdf.js document (`pdfDocument.getData()`), so the
 * export never re-fetches the URL (presigned URLs are method-bound and may have expired) and never
 * issues HEAD probes.
 *
 * Geometry: every annotation is converted from the viewer's base page space to PDF user space
 * through `annotations/geometry.ts` (the same transform pdf.js uses), so baked markup lands exactly
 * where it was drawn — on any page size, CropBox offset or intrinsic /Rotate.
 */
import { PDFDocument, rgb, degrees, StandardFonts, BlendMode, type PDFPage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocumentParams } from './pdfAssets';
import type { Annotation } from '../annotations/types';
import type { Redaction, WatermarkOptions } from './types';
import { createGeometryResolver, pathToPdf, rectToPdf, toPdfPoint, type GeometryResolver, type PageGeometry } from '../annotations/geometry';

/** Refuse to build documents larger than this in the browser (memory safety). */
export const MAX_EXPORT_BYTES = 500 * 1024 * 1024;

export interface ExportInput {
  /** Returns the original document bytes (prefer `pdfDocument.getData()`). */
  getSourceBytes: () => Promise<Uint8Array | ArrayBuffer>;
  /** Page geometry resolver (from the loaded pdf.js document). Derived from the bytes when absent. */
  getPageGeometry?: GeometryResolver;
  annotations: Annotation[];
  redactions: Redaction[];
  watermark?: WatermarkOptions;
  /** Name printed on digital-signature placeholder blocks when the annotation has no signer. */
  signerName?: string;
}

export interface ExportOptions {
  /** Bake exactly these annotations instead of the live list. */
  explicitAnnotations?: Annotation[];
  /** Accepted for API compatibility; annotations are always taken from the live list / explicitAnnotations. */
  xfdfString?: string;
}

const hexToRgb = (hex: string | undefined) => {
  const safe = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  const r = parseInt(safe.slice(1, 3), 16) / 255;
  const g = parseInt(safe.slice(3, 5), 16) / 255;
  const b = parseInt(safe.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

async function bakeAnnotation(pdfDoc: PDFDocument, page: PDFPage, g: PageGeometry, ann: Annotation, signerName?: string): Promise<void> {
  const color = hexToRgb(ann.color);
  const opacity = ann.opacity ?? 1;
  const strokeWidth = ann.strokeWidth || 1;
  const rect = rectToPdf(g, { x: ann.x, y: ann.y, width: ann.width, height: ann.height });
  const [llx, lly, urx, ury] = rect;
  const w = urx - llx;
  const h = ury - lly;
  // Text drawn in user space appears rotated by /Rotate in the viewer; counter-rotate so it reads
  // upright the way it was authored.
  const textRotate = degrees(g.rotate);
  const topLeftBaseline = (x: number, y: number, size: number) => toPdfPoint(g, { x, y: y + size });

  switch (ann.type) {
    case 'rectangle':
      page.drawRectangle({ x: llx, y: lly, width: w, height: h, color, opacity, borderColor: color, borderWidth: strokeWidth, borderOpacity: 1 });
      return;
    case 'ellipse':
      page.drawEllipse({ x: llx + w / 2, y: lly + h / 2, xScale: w / 2, yScale: h / 2, color, opacity, borderColor: color, borderWidth: strokeWidth, borderOpacity: 1 });
      return;
    case 'highlight': {
      const rects = ann.rects && ann.rects.length > 0 ? ann.rects : [{ x: ann.x, y: ann.y, width: ann.width, height: ann.height }];
      for (const r of rects) {
        const [x0, y0, x1, y1] = rectToPdf(g, r);
        page.drawRectangle({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, color, opacity: opacity < 1 ? opacity : 0.5, blendMode: BlendMode.Multiply });
      }
      return;
    }
    case 'line':
    case 'arrow': {
      const pts = ann.points && ann.points.length >= 2 ? ann.points : [{ x: ann.x, y: ann.y }, { x: ann.x + ann.width, y: ann.y + ann.height }];
      const [s, e] = pathToPdf(g, [pts[0], pts[1]]);
      page.drawLine({ start: s, end: e, color, opacity, thickness: strokeWidth });
      if (ann.type === 'arrow') {
        // Arrow head computed in viewer space (same as the on-screen rendering), then converted.
        const p1 = pts[0], p2 = pts[1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLen = 15 + strokeWidth;
        const h1 = { x: p2.x - headLen * Math.cos(angle - Math.PI / 6), y: p2.y - headLen * Math.sin(angle - Math.PI / 6) };
        const h2 = { x: p2.x - headLen * Math.cos(angle + Math.PI / 6), y: p2.y - headLen * Math.sin(angle + Math.PI / 6) };
        const [ph1, ph2] = pathToPdf(g, [h1, h2]);
        page.drawLine({ start: ph1, end: e, color, opacity, thickness: strokeWidth });
        page.drawLine({ start: ph2, end: e, color, opacity, thickness: strokeWidth });
      }
      return;
    }
    case 'freehand': {
      const strokes = ann.strokes && ann.strokes.length > 0 ? ann.strokes : ann.points ? [ann.points] : [];
      for (const st of strokes) {
        const pdfPts = pathToPdf(g, st);
        for (let i = 1; i < pdfPts.length; i++) {
          page.drawLine({ start: pdfPts[i - 1], end: pdfPts[i], color, opacity, thickness: strokeWidth, lineCap: 1 });
        }
      }
      return;
    }
    case 'text': {
      if (!ann.text) return;
      const b = topLeftBaseline(ann.x, ann.y, 16);
      page.drawText(ann.text, { x: b.x, y: b.y, size: 16, color, opacity, rotate: textRotate });
      return;
    }
    case 'note': {
      const [nx0, ny0, nx1, ny1] = rectToPdf(g, { x: ann.x, y: ann.y, width: 24, height: 24 });
      page.drawRectangle({ x: nx0, y: ny0, width: nx1 - nx0, height: ny1 - ny0, color: rgb(1, 0.97, 0.7), borderColor: color, borderWidth: strokeWidth });
      if (ann.text) {
        const b = topLeftBaseline(ann.x + 30, ann.y, 14);
        page.drawText(ann.text, { x: b.x, y: b.y, size: 14, color, opacity, rotate: textRotate });
      }
      return;
    }
    case 'callout': {
      const pts = ann.points && ann.points.length >= 2 ? ann.points : [{ x: ann.x, y: ann.y }, { x: ann.x, y: ann.y }];
      const [s, e] = pathToPdf(g, [pts[0], pts[1]]);
      page.drawLine({ start: s, end: e, color, opacity, thickness: strokeWidth });
      if (ann.text) {
        const boxW = ann.text.length * 8 + 20;
        const [bx0, by0, bx1, by1] = rectToPdf(g, { x: pts[1].x, y: pts[1].y, width: boxW, height: 24 });
        page.drawRectangle({ x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, color: rgb(1, 1, 1), borderColor: color, borderWidth: strokeWidth });
        const b = topLeftBaseline(pts[1].x + 10, pts[1].y + 2, 14);
        page.drawText(ann.text, { x: b.x, y: b.y, size: 14, color, opacity, rotate: textRotate });
      }
      return;
    }
    case 'signature': {
      if (!ann.imageUrl) return;
      const imageBytes = await fetch(ann.imageUrl).then((res) => res.arrayBuffer());
      const image = ann.imageUrl.startsWith('data:image/jpeg') || ann.imageUrl.startsWith('data:image/jpg')
        ? await pdfDoc.embedJpg(imageBytes)
        : await pdfDoc.embedPng(imageBytes);
      page.drawImage(image, { x: llx, y: lly, width: w, height: h, rotate: textRotate });
      return;
    }
    case 'digital_signature_placeholder': {
      const dateStr = ann.timestamp ? new Date(ann.timestamp).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      const iconW = w * 0.15;
      page.drawRectangle({ x: llx, y: lly, width: w, height: h, color: rgb(1, 1, 1), borderColor: rgb(148 / 255, 163 / 255, 184 / 255), borderWidth: 1 });
      page.drawLine({ start: { x: llx + iconW, y: lly }, end: { x: llx + iconW, y: lly + h }, color: rgb(226 / 255, 232 / 255, 240 / 255), thickness: 1 });
      page.drawSvgPath('M22 6 L22 14 Q22 20 12 24 Q2 20 2 14 L2 6 L12 2 Z', { x: llx + iconW / 2 - 12, y: lly + h / 2 + 12, borderColor: rgb(2 / 255, 132 / 255, 199 / 255), borderWidth: 2, scale: 1 });
      page.drawSvgPath('M7 13 L10 16 L17 8', { x: llx + iconW / 2 - 12, y: lly + h / 2 + 12, borderColor: rgb(2 / 255, 132 / 255, 199 / 255), borderWidth: 2, scale: 1 });
      page.drawText(`Digitally signed by ${ann.signer || signerName || 'Unknown signer'}`, { x: llx + iconW + 10, y: lly + h - 16, size: 10, color: rgb(15 / 255, 23 / 255, 42 / 255) });
      page.drawText(`Date: ${dateStr}`, { x: llx + iconW + 10, y: lly + h - 28, size: 9, color: rgb(51 / 255, 65 / 255, 85 / 255) });
      page.drawText('Reason: Document Approval', { x: llx + iconW + 10, y: lly + h - 40, size: 9, color: rgb(51 / 255, 65 / 255, 85 / 255) });
      return;
    }
    case 'link':
    case 'opaque':
    default:
      return; // not visual (link) or not ours to render (opaque)
  }
}

async function bakeWatermark(pdfDoc: PDFDocument, wm: WatermarkOptions): Promise<void> {
  const wmColor = hexToRgb(wm.color || '#737373');
  const wmOpacity = wm.opacity ?? 0.08;
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const angle = -Math.PI / 4;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    if (wm.mode === 'single') {
      const fontSize = wm.size || 48;
      const textWidth = helveticaFont.widthOfTextAtSize(wm.text, fontSize);
      const dx = -textWidth / 2;
      const dy = -fontSize * 0.35;
      page.drawText(wm.text, {
        x: width / 2 + (dx * cosA - dy * sinA),
        y: height / 2 + (dx * sinA + dy * cosA),
        size: fontSize, font: helveticaFont, color: wmColor, opacity: wmOpacity, rotate: degrees(-45),
      });
    } else {
      const fontSize = wm.size || 18;
      const textWidth = helveticaFont.widthOfTextAtSize(wm.text, fontSize);
      const xStep = textWidth + 150;
      const yStep = 250;
      const dx = -textWidth / 2;
      const dy = -fontSize * 0.35;
      const rotatedDx = dx * cosA - dy * sinA;
      const rotatedDy = dx * sinA + dy * cosA;
      for (let y = -height; y < height * 2; y += yStep) {
        const offset = (Math.abs(y / yStep) % 2) * (xStep / 2);
        for (let x = -width; x < width * 2; x += xStep) {
          page.drawText(wm.text, { x: x + offset + rotatedDx, y: y + rotatedDy, size: fontSize, font: helveticaFont, color: wmColor, opacity: wmOpacity, rotate: degrees(-45) });
        }
      }
    }
  }
}

async function rasterizeRedactions(pdfDoc: PDFDocument, redactions: Redaction[]): Promise<PDFDocument> {
  const tempBuffer = await pdfDoc.save();
  const loadingTask = pdfjsLib.getDocument({ data: tempBuffer, ...getDocumentParams() });
  const renderDoc = await loadingTask.promise;
  const flattenedPdf = await PDFDocument.create();

  try {
    for (let i = 1; i <= renderDoc.numPages; i++) {
      const pageRedactions = redactions.filter((r) => r.pageIndex === i);
      if (pageRedactions.length > 0) {
        const renderPage = await renderDoc.getPage(i);
        const rasterScale = 2.0;
        const viewport = renderPage.getViewport({ scale: rasterScale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await renderPage.render({ canvasContext: ctx, canvas, viewport }).promise;
          ctx.save();
          ctx.fillStyle = '#000000';
          for (const redaction of pageRedactions) {
            ctx.fillRect(
              Math.floor(redaction.x * rasterScale),
              Math.floor(redaction.y * rasterScale),
              Math.ceil(redaction.width * rasterScale),
              Math.ceil(redaction.height * rasterScale)
            );
          }
          ctx.restore();
          const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const imgBytes = await fetch(imgDataUrl).then((res) => res.arrayBuffer());
          const pdfImage = await flattenedPdf.embedJpg(imgBytes);
          const originalVp = renderPage.getViewport({ scale: 1 });
          const newPage = flattenedPdf.addPage([originalVp.width, originalVp.height]);
          newPage.drawImage(pdfImage, { x: 0, y: 0, width: originalVp.width, height: originalVp.height });
          canvas.width = 0;
          canvas.height = 0;
        }
        renderPage.cleanup();
      } else {
        const [copiedPage] = await flattenedPdf.copyPages(pdfDoc, [i - 1]);
        flattenedPdf.addPage(copiedPage);
      }
      if (i % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await loadingTask.destroy().catch(() => {});
  }
  return flattenedPdf;
}

export async function buildPdfBytes(input: ExportInput, options: ExportOptions = {}): Promise<Uint8Array> {
  if (options.xfdfString) {
    console.warn('[teamsync-pdf-viewer] getFileData({ xfdfString }) is ignored; import the XFDF through annotationManager.importAnnotations() first.');
  }

  const raw = await input.getSourceBytes();
  const sourceBytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (sourceBytes.byteLength > MAX_EXPORT_BYTES) {
    const sizeMB = (sourceBytes.byteLength / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File is too large (${sizeMB} MB) to save directly in the browser. ` +
        'Use exportAnnotations() to save annotation data and apply it on your server.'
    );
  }

  const pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const anns = options.explicitAnnotations || input.annotations;

  // Geometry: prefer the live pdf.js document; otherwise derive it from the bytes.
  let resolveGeometry = input.getPageGeometry;
  let geometryTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  if (!resolveGeometry && anns.length > 0) {
    geometryTask = pdfjsLib.getDocument({ data: sourceBytes.slice(), ...getDocumentParams() });
    resolveGeometry = createGeometryResolver(await geometryTask.promise);
  }

  try {
    for (const ann of anns) {
      const pageIdx = Math.max(0, Math.min((ann.pageIndex || 1) - 1, pages.length - 1));
      const g = await resolveGeometry!(pageIdx + 1);
      await bakeAnnotation(pdfDoc, pages[pageIdx], g, ann, input.signerName);
    }
  } finally {
    if (geometryTask) await geometryTask.destroy().catch(() => {});
  }

  if (input.watermark?.text) await bakeWatermark(pdfDoc, input.watermark);

  const combinedRedactions = input.redactions || [];
  const finalDoc = combinedRedactions.length > 0 ? await rasterizeRedactions(pdfDoc, combinedRedactions) : pdfDoc;
  return await finalDoc.save();
}
