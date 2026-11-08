/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * acroFormIngestion.test.ts — verifies Item 8 optimizations:
 * - Cheap getFieldObjects() catalog check (0 page reads when null or empty)
 * - Candidate page identification (only pages with widgets are inspected)
 * - Viewport-outward idle slicing
 * - Cancellation handling
 */

import { describe, expect, it, vi } from 'vitest';
import { extractAcroFormFields } from './acroFormIngestion';

describe('extractAcroFormFields Optimization (Item 8)', () => {
  it('returns empty fields immediately when doc.getFieldObjects() returns null without walking any pages (Item 8a)', async () => {
    const getPageMock = vi.fn();
    const mockPdfDoc = {
      numPages: 256,
      getFieldObjects: vi.fn().mockResolvedValue(null),
      getPage: getPageMock,
    };

    const result = await extractAcroFormFields(mockPdfDoc);

    expect(mockPdfDoc.getFieldObjects).toHaveBeenCalledTimes(1);
    expect(getPageMock).not.toHaveBeenCalled();
    expect(result.fields).toEqual([]);
    expect(result.values).toEqual({});
  });

  it('returns empty fields immediately when doc.getFieldObjects() returns an empty Map or Object', async () => {
    const getPageMock = vi.fn();
    const mockPdfDocWithMap = {
      numPages: 100,
      getFieldObjects: vi.fn().mockResolvedValue(new Map()),
      getPage: getPageMock,
    };

    const res1 = await extractAcroFormFields(mockPdfDocWithMap);
    expect(getPageMock).not.toHaveBeenCalled();
    expect(res1.fields).toEqual([]);

    const mockPdfDocWithObj = {
      numPages: 100,
      getFieldObjects: vi.fn().mockResolvedValue({}),
      getPage: getPageMock,
    };

    const res2 = await extractAcroFormFields(mockPdfDocWithObj);
    expect(getPageMock).not.toHaveBeenCalled();
    expect(res2.fields).toEqual([]);
  });

  it('inspects only candidate pages identified by getFieldObjects() and skips all other pages', async () => {
    const getPageMock = vi.fn((pageNum: number) => {
      return Promise.resolve({
        getViewport: () => ({ width: 612, height: 792 }),
        getAnnotations: () => [
          {
            id: `widget_${pageNum}`,
            subtype: 'Widget',
            fieldName: `field_p${pageNum}`,
            fieldType: 'Tx',
            rect: [50, 700, 200, 730],
            fieldValue: `value_p${pageNum}`,
          },
        ],
      });
    });

    const fieldMap = new Map();
    // Widget only on page 1 (page: 0) and page 5 (page: 4)
    fieldMap.set('field_p1', [
      { id: '1R', page: 0, rect: [50, 700, 200, 730], name: 'field_p1', type: 'text' },
    ]);
    fieldMap.set('field_p5', [
      { id: '5R', page: 4, rect: [50, 700, 200, 730], name: 'field_p5', type: 'text' },
    ]);

    const mockPdfDoc = {
      numPages: 300,
      getFieldObjects: vi.fn().mockResolvedValue(fieldMap),
      getPage: getPageMock,
    };

    const result = await extractAcroFormFields(mockPdfDoc, undefined, { viewportPage: 1 });

    // Should ONLY have called getPage for candidate pages: 1 and 5
    expect(getPageMock).toHaveBeenCalledTimes(2);
    expect(getPageMock).toHaveBeenCalledWith(1);
    expect(getPageMock).toHaveBeenCalledWith(5);
    expect(getPageMock).not.toHaveBeenCalledWith(2);
    expect(getPageMock).not.toHaveBeenCalledWith(300);

    expect(result.fields.length).toBe(2);
    expect(result.values['field_p1']).toBe('value_p1');
    expect(result.values['field_p5']).toBe('value_p5');
  });

  it('scans candidate pages viewport-outward from viewportPage', async () => {
    const calledPages: number[] = [];
    const getPageMock = vi.fn((pageNum: number) => {
      calledPages.push(pageNum);
      return Promise.resolve({
        getViewport: () => ({ width: 612, height: 792 }),
        getAnnotations: () => [],
      });
    });

    const fieldMap = new Map();
    fieldMap.set('f1', [{ page: 0 }]); // Page 1
    fieldMap.set('f10', [{ page: 9 }]); // Page 10
    fieldMap.set('f50', [{ page: 49 }]); // Page 50
    fieldMap.set('f8', [{ page: 7 }]); // Page 8

    const mockPdfDoc = {
      numPages: 100,
      getFieldObjects: vi.fn().mockResolvedValue(fieldMap),
      getPage: getPageMock,
    };

    // Viewport currently at page 10
    await extractAcroFormFields(mockPdfDoc, undefined, { viewportPage: 10, sliceSize: 10 });

    // Page 10 (dist 0), then page 8 (dist 2), then page 1 (dist 9), then page 50 (dist 40)
    expect(calledPages).toEqual([10, 8, 1, 50]);
  });

  it('respects cancellation checker and halts immediately', async () => {
    let callCount = 0;
    const getPageMock = vi.fn(() => {
      callCount++;
      return Promise.resolve({
        getViewport: () => ({ width: 612, height: 792 }),
        getAnnotations: () => [],
      });
    });

    const fieldMap = new Map();
    for (let i = 0; i < 20; i++) {
      fieldMap.set(`f_${i}`, [{ page: i }]);
    }

    const mockPdfDoc = {
      numPages: 100,
      getFieldObjects: vi.fn().mockResolvedValue(fieldMap),
      getPage: getPageMock,
    };

    let cancelled = false;
    const isCancelled = () => {
      if (callCount >= 2) cancelled = true;
      return cancelled;
    };

    await extractAcroFormFields(mockPdfDoc, undefined, {
      viewportPage: 1,
      sliceSize: 1,
      isCancelled,
    });

    expect(callCount).toBeLessThan(5);
  });

  it('falls back to scanning pages if getFieldObjects is not a function', async () => {
    const getPageMock = vi.fn((pageNum: number) => {
      return Promise.resolve({
        getViewport: () => ({ width: 612, height: 792 }),
        getAnnotations: () => [
          {
            id: `widget_${pageNum}`,
            subtype: 'Widget',
            fieldName: `field_${pageNum}`,
            fieldType: 'Tx',
            rect: [50, 700, 200, 730],
            fieldValue: `val_${pageNum}`,
          },
        ],
      });
    });

    const legacyMockDoc = {
      numPages: 3,
      // getFieldObjects not defined
      getPage: getPageMock,
    };

    const result = await extractAcroFormFields(legacyMockDoc, undefined, { sliceSize: 10 });

    expect(getPageMock).toHaveBeenCalledTimes(3);
    expect(result.fields.length).toBe(3);
  });
});
