/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * acroFormIngestion — detects and extracts pre-existing AcroForm / Widget annotations
 * from loaded PDF documents into interactive FormField models (F12, Item 8).
 */

import type { FormField, FormDataRecord } from './types';
import { generateSecureId } from '../annotations/ids';
import { rectFromPdf, type GeometryResolver, type PageGeometry } from '../annotations/geometry';

export interface AcroFormIngestionOptions {
  /** Page number currently in view to prioritize scanning outward from (default: 1) */
  viewportPage?: number;
  /** Number of pages to scan per idle slice (default: 6) */
  sliceSize?: number;
  /** Optional cancellation checker */
  isCancelled?: () => boolean;
}

export async function extractAcroFormFields(
  pdfDoc: any,
  resolver?: GeometryResolver,
  options?: AcroFormIngestionOptions
): Promise<{ fields: FormField[]; values: FormDataRecord }> {
  const fields: FormField[] = [];
  const values: FormDataRecord = {};
  if (!pdfDoc) return { fields, values };

  let candidatePages: Set<number> | null = null;

  // Item 8a: Cheaply check if the document catalog has an /AcroForm entry
  if (typeof pdfDoc.getFieldObjects === 'function') {
    try {
      const fieldObjects = await pdfDoc.getFieldObjects();
      // null / undefined means catalog has no /AcroForm dictionary — 0 page reads needed!
      if (fieldObjects === null || fieldObjects === undefined) {
        return { fields, values };
      }

      let hasEntries = false;
      candidatePages = new Set<number>();

      if (fieldObjects instanceof Map) {
        hasEntries = fieldObjects.size > 0;
        for (const items of fieldObjects.values()) {
          if (Array.isArray(items)) {
            for (const item of items) {
              if (typeof item?.page === 'number' && item.page >= 0) {
                candidatePages.add(item.page + 1);
              }
            }
          }
        }
      } else if (typeof fieldObjects === 'object') {
        const entries = Object.values(fieldObjects);
        hasEntries = entries.length > 0;
        for (const items of entries) {
          if (Array.isArray(items as any[])) {
            for (const item of items as any[]) {
              if (typeof item?.page === 'number' && item.page >= 0) {
                candidatePages.add(item.page + 1);
              }
            }
          }
        }
      }

      // If getFieldObjects resolved with an empty map/object or no page widgets
      if (!hasEntries || candidatePages.size === 0) {
        return { fields, values };
      }
    } catch (err) {
      console.warn('[teamsync-pdf-viewer] doc.getFieldObjects() check failed, falling back to page scan:', err);
      candidatePages = null;
    }
  }

  if (typeof pdfDoc.getPage !== 'function') {
    return { fields, values };
  }

  const numPages = pdfDoc.numPages || 1;
  const viewportPage = Math.max(1, Math.min(numPages, options?.viewportPage ?? 1));
  const sliceSize = Math.max(1, options?.sliceSize ?? 6);

  let pagesToScan: number[];
  if (candidatePages !== null) {
    pagesToScan = Array.from(candidatePages).filter((p) => p >= 1 && p <= numPages);
  } else {
    pagesToScan = [];
    for (let p = 1; p <= numPages; p++) {
      pagesToScan.push(p);
    }
  }

  // Sort candidate pages viewport-outward so visible pages resolve first
  pagesToScan.sort((a, b) => {
    const distA = Math.abs(a - viewportPage);
    const distB = Math.abs(b - viewportPage);
    if (distA !== distB) return distA - distB;
    return a - b;
  });

  const seenFieldNames = new Set<string>();

  const yieldIdle = (): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve(), { timeout: 100 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  };

  for (let i = 0; i < pagesToScan.length; i += sliceSize) {
    if (options?.isCancelled?.()) break;

    // Yield to the event loop between slices after the first slice
    if (i > 0) {
      await yieldIdle();
      if (options?.isCancelled?.()) break;
    }

    const slice = pagesToScan.slice(i, i + sliceSize);
    for (const pageNum of slice) {
      if (options?.isCancelled?.()) break;
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (options?.isCancelled?.()) break;
        const viewport = page.getViewport({ scale: 1 });
        const annotations = await page.getAnnotations({ intent: 'display' });
        let g: PageGeometry | null = null;
        if (resolver) {
          try {
            g = await resolver(pageNum);
          } catch {}
        }

        for (const a of annotations) {
          if (a.subtype !== 'Widget' || !a.rect || a.rect.length !== 4) continue;
          const name = (a.fieldName || a.id || `field_${pageNum}_${fields.length + 1}`).trim();
          if (seenFieldNames.has(name)) continue;
          seenFieldNames.add(name);

          let x = a.rect[0];
          let width = Math.max(10, a.rect[2] - a.rect[0]);
          let height = Math.max(10, a.rect[3] - a.rect[1]);
          let y = viewport.height - a.rect[3];

          if (g) {
            try {
              const unrot = rectFromPdf(g, a.rect);
              x = unrot.x;
              y = unrot.y;
              width = unrot.width;
              height = unrot.height;
            } catch {}
          }

          let type: FormField['type'] = 'text';
          if (a.fieldType === 'Btn') {
            if (a.radioButton) {
              type = 'radio';
            } else {
              type = 'checkbox';
            }
          } else if (a.fieldType === 'Ch') {
            type = 'dropdown';
          } else if (a.fieldType === 'Sig') {
            type = 'signature';
          } else if (a.fieldType === 'Tx') {
            type = a.multiLine ? 'textarea' : 'text';
          }

          let fieldVal = a.fieldValue !== undefined ? a.fieldValue : a.defaultFieldValue;
          if (type === 'checkbox') {
            fieldVal = Boolean(a.fieldValue === true || a.fieldValue === 'Yes' || a.fieldValue === 'On');
          }

          const fieldOptions = Array.isArray(a.options)
            ? a.options.map((o: any) => (typeof o === 'string' ? o : o.displayValue || o.exportValue))
            : undefined;

          fields.push({
            id: a.id || generateSecureId('field'),
            name,
            type,
            pageIndex: pageNum,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
            label: a.alternativeText || name,
            required: Boolean(a.required),
            readOnly: Boolean(a.readOnly),
            defaultValue: fieldVal,
            options: fieldOptions,
          });

          if (fieldVal !== undefined && fieldVal !== null && fieldVal !== '') {
            values[name] = fieldVal;
          }
        }
      } catch (err) {
        console.warn(`[teamsync-pdf-viewer] Failed to scan AcroForms on page ${pageNum}:`, err);
      }
    }
  }

  return { fields, values };
}
