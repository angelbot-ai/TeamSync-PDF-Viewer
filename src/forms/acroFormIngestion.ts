/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * acroFormIngestion — detects and extracts pre-existing AcroForm / Widget annotations
 * from loaded PDF documents into interactive FormField models (F12).
 */

import type { FormField, FormDataRecord } from './types';
import { generateSecureId } from '../annotations/ids';
import { rectFromPdf, type GeometryResolver, type PageGeometry } from '../annotations/geometry';

export async function extractAcroFormFields(
  pdfDoc: any,
  resolver?: GeometryResolver
): Promise<{ fields: FormField[]; values: FormDataRecord }> {
  const fields: FormField[] = [];
  const values: FormDataRecord = {};
  if (!pdfDoc || typeof pdfDoc.getPage !== 'function') return { fields, values };

  const numPages = pdfDoc.numPages || 1;
  const seenFieldNames = new Set<string>();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
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

        const options = Array.isArray(a.options)
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
          options,
        });

        if (fieldVal !== undefined && fieldVal !== null && fieldVal !== '') {
          values[name] = fieldVal;
        }
      }
    } catch (err) {
      console.warn(`[teamsync-pdf-viewer] Failed to scan AcroForms on page ${pageNum}:`, err);
    }
  }

  return { fields, values };
}
