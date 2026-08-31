/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * PDF export: bakes annotations + watermark into a copy of the source document and rasterizes
 * redacted pages so the underlying content is destroyed.
 *
 * The source bytes come from the already-loaded pdf.js document (`pdfDocument.getData()`), so the
 * export never re-fetches the URL (presigned URLs are method-bound and may have expired) and never
 * issues HEAD probes.
 *
 * NOTE (geometry): annotation → PDF user-space conversion still divides by a fixed 1.5 factor,
 * inherited from the original implementation. It is replaced by `annotations/geometry.ts` in 1.2.0.
 */
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { getDocumentParams } from './pdfAssets';
import type { Annotation } from '../annotations/types';
import type { Redaction, WatermarkOptions } from './types';

/** Refuse to build documents larger than this in the browser (memory safety). */
export const MAX_EXPORT_BYTES = 500 * 1024 * 1024;

export interface ExportInput {
  /** Returns the original document bytes (prefer `pdfDocument.getData()`). */
  getSourceBytes: () => Promise<Uint8Array | ArrayBuffer>;
  annotations: Annotation[];
  redactions: Redaction[];
  watermark?: WatermarkOptions;
  /** Name printed on digital-signature placeholder blocks when the annotation has no signer. */
  signerName?: string;
}

export interface ExportOptions {
  /** Bake exactly these annotations instead of the live list. */
  explicitAnnotations?: Annotation[];
  /** Accepted for API compatibility. Honoured from 1.2.0 (native XFDF import). */
  xfdfString?: string;
}

const hexToRgb = (hex: string) => {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  const r = parseInt(safe.slice(1, 3), 16) / 255;
  const g = parseInt(safe.slice(3, 5), 16) / 255;
  const b = parseInt(safe.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

export async function buildPdfBytes(input: ExportInput, options: ExportOptions = {}): Promise<Uint8Array> {
  if (options.xfdfString) {
    console.warn('[teamsync-pdf-viewer] getFileData({ xfdfString }) is not supported yet; the live annotation list is used instead.');
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

  // These conversions assume scale=1.5 (legacy). Replaced by annotations/geometry.ts in 1.2.0.
  const scale = 1.5;

  for (const ann of anns) {
    const targetPageIdx = Math.max(0, Math.min((ann.pageIndex || 1) - 1, pages.length - 1));
    const page = pages[targetPageIdx];
    const { height } = page.getSize();

    const color = hexToRgb(ann.color || '#000000');
    const opacity = ann.opacity || 1;
    const strokeWidth = ann.strokeWidth || 1;

    if (ann.type === 'rectangle') {
      page.drawRectangle({
        x: ann.x / scale,
        y: height - ann.y / scale - ann.height / scale,
        width: ann.width / scale,
        height: ann.height / scale,
        color,
        opacity,
        borderColor: color,
        borderWidth: strokeWidth,
      });
    } else if (ann.type === 'text' && ann.text) {
      page.drawText(ann.text, {
        x: ann.x / scale,
        y: height - ann.y / scale - 16,
        size: 16 / scale,
        color,
        opacity,
      });
    } else if (ann.type === 'ellipse') {
      page.drawEllipse({
        x: (ann.x + ann.width / 2) / scale,
        y: height - (ann.y + ann.height / 2) / scale,
        xScale: ann.width / 2 / scale,
        yScale: ann.height / 2 / scale,
        color,
        opacity,
        borderColor: color,
        borderWidth: strokeWidth,
      });
    } else if (ann.type === 'line' && ann.points && ann.points.length >= 2) {
      page.drawLine({
        start: { x: ann.points[0].x / scale, y: height - ann.points[0].y / scale },
        end: { x: ann.points[1].x / scale, y: height - ann.points[1].y / scale },
        color,
        opacity,
        thickness: strokeWidth,
      });
    } else if (ann.type === 'freehand' && ann.points && ann.points.length > 0) {
      const d = `M ${ann.points.map((p) => `${p.x / scale},${height - p.y / scale}`).join(' L ')}`;
      page.drawSvgPath(d, { borderColor: color, borderWidth: strokeWidth, opacity });
    } else if (ann.type === 'note') {
      page.drawRectangle({
        x: ann.x / scale,
        y: height - ann.y / scale - 24,
        width: 24,
        height: 24,
        color: rgb(1, 0.97, 0.7),
        borderColor: color,
        borderWidth: strokeWidth,
      });
      if (ann.text) {
        page.drawText(ann.text, {
          x: (ann.x + 30) / scale,
          y: height - ann.y / scale - 16,
          size: 14 / scale,
          color,
          opacity,
        });
      }
    } else if (ann.type === 'callout' && ann.points && ann.points.length >= 2) {
      page.drawLine({
        start: { x: ann.points[0].x / scale, y: height - ann.points[0].y / scale },
        end: { x: ann.points[1].x / scale, y: height - ann.points[1].y / scale },
        color,
        opacity,
        thickness: strokeWidth,
      });
      if (ann.text) {
        page.drawRectangle({
          x: ann.points[1].x / scale,
          y: height - ann.points[1].y / scale - 20,
          width: (ann.text.length * 8 + 20) / scale,
          height: 24 / scale,
          color: rgb(1, 1, 1),
          borderColor: color,
          borderWidth: strokeWidth,
        });
        page.drawText(ann.text, {
          x: (ann.points[1].x + 10) / scale,
          y: height - ann.points[1].y / scale - 14,
          size: 14 / scale,
          color,
          opacity,
        });
      }
    } else if (ann.type === 'signature' && ann.imageUrl) {
      const imageBytes = await fetch(ann.imageUrl).then((res) => res.arrayBuffer());
      const image = await pdfDoc.embedPng(imageBytes);
      page.drawImage(image, {
        x: ann.x / scale,
        y: height - ann.y / scale - ann.height / scale,
        width: ann.width / scale,
        height: ann.height / scale,
      });
    } else if (ann.type === 'digital_signature_placeholder') {
      const rectX = ann.x / scale;
      const rectW = ann.width / scale;
      const rectH = ann.height / scale;
      const rectY = height - ann.y / scale - rectH;

      const dateStr = ann.timestamp ? new Date(ann.timestamp).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      const iconW = rectW * 0.15;

      page.drawRectangle({
        x: rectX, y: rectY, width: rectW, height: rectH,
        color: rgb(1, 1, 1),
        borderColor: rgb(148 / 255, 163 / 255, 184 / 255),
        borderWidth: 1,
      });
      page.drawLine({
        start: { x: rectX + iconW, y: rectY },
        end: { x: rectX + iconW, y: rectY + rectH },
        color: rgb(226 / 255, 232 / 255, 240 / 255),
        thickness: 1,
      });
      page.drawSvgPath('M22 6 L22 14 Q22 20 12 24 Q2 20 2 14 L2 6 L12 2 Z', {
        x: rectX + iconW / 2 - 12,
        y: rectY + rectH / 2 + 12,
        borderColor: rgb(2 / 255, 132 / 255, 199 / 255),
        borderWidth: 2,
        scale: 1,
      });
      page.drawSvgPath('M7 13 L10 16 L17 8', {
        x: rectX + iconW / 2 - 12,
        y: rectY + rectH / 2 + 12,
        borderColor: rgb(2 / 255, 132 / 255, 199 / 255),
        borderWidth: 2,
        scale: 1,
      });
      page.drawText(`Digitally signed by ${ann.signer || input.signerName || 'Unknown signer'}`, {
        x: rectX + iconW + 10, y: rectY + rectH - 16,
        size: 10, color: rgb(15 / 255, 23 / 255, 42 / 255),
      });
      page.drawText(`Date: ${dateStr}`, {
        x: rectX + iconW + 10, y: rectY + rectH - 28,
        size: 9, color: rgb(51 / 255, 65 / 255, 85 / 255),
      });
      page.drawText('Reason: Document Approval', {
        x: rectX + iconW + 10, y: rectY + rectH - 40,
        size: 9, color: rgb(51 / 255, 65 / 255, 85 / 255),
      });
    }
  }

  // --- Watermark baking ---
  if (input.watermark?.text) {
    const wm = input.watermark;
    const wmColor = hexToRgb(wm.color || '#737373');
    const wmOpacity = wm.opacity ?? 0.08;
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const page of pages) {
      const { width, height } = page.getSize();
      const angle = -Math.PI / 4;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      if (wm.mode === 'single') {
        const fontSize = wm.size || 48;
        const textWidth = helveticaFont.widthOfTextAtSize(wm.text, fontSize);
        const dx = -textWidth / 2;
        const dy = -fontSize * 0.35;
        const rotatedDx = dx * cosA - dy * sinA;
        const rotatedDy = dx * sinA + dy * cosA;
        page.drawText(wm.text, {
          x: width / 2 + rotatedDx,
          y: height / 2 + rotatedDy,
          size: fontSize,
          font: helveticaFont,
          color: wmColor,
          opacity: wmOpacity,
          rotate: degrees(-45),
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
            page.drawText(wm.text, {
              x: x + offset + rotatedDx,
              y: y + rotatedDy,
              size: fontSize,
              font: helveticaFont,
              color: wmColor,
              opacity: wmOpacity,
              rotate: degrees(-45),
            });
          }
        }
      }
    }
  }

  // --- Secure rasterization for redactions ---
  const combinedRedactions = input.redactions || [];
  let finalDoc = pdfDoc;

  if (combinedRedactions.length > 0) {
    const tempBuffer = await pdfDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: tempBuffer, ...getDocumentParams() });
    const renderDoc = await loadingTask.promise;
    const flattenedPdf = await PDFDocument.create();

    try {
      for (let i = 1; i <= renderDoc.numPages; i++) {
        const pageRedactions = combinedRedactions.filter((r) => r.pageIndex === i);

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

        if (i % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      await loadingTask.destroy().catch(() => {});
    }
    finalDoc = flattenedPdf;
  }

  return await finalDoc.save();
}
