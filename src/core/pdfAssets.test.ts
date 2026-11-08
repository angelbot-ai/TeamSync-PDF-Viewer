import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => {
  class MockWorker {
    destroyed = false;
    destroy() {
      this.destroyed = true;
    }
  }
  class MockDataRangeTransport {}
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    version: '6.2.108',
    PDFWorker: MockWorker,
    PDFDataRangeTransport: MockDataRangeTransport,
  };
});

import * as pdfjsLib from 'pdfjs-dist';
import {
  assertWorkerConfigured,
  configurePdfAssets,
  getDocumentParams,
  isWorkerConfigured,
  createPdfWorker,
  getSharedPdfWorker,
  destroySharedPdfWorker,
} from './pdfAssets';
import * as indexExports from '../index';

describe('pdfAssets', () => {
  beforeEach(() => {
    (pdfjsLib.GlobalWorkerOptions as { workerSrc: string }).workerSrc = '';
  });

  it('throws a descriptive error until a worker is configured', () => {
    expect(isWorkerConfigured()).toBe(false);
    expect(() => assertWorkerConfigured()).toThrow(/configurePdfAssets/);
  });

  it('configures the pdf.js worker and derives getDocument() params', () => {
    configurePdfAssets({
      workerSrc: '/pdfjs/pdf.worker.min.mjs',
      cMapUrl: '/pdfjs/cmaps/',
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
    });
    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('/pdfjs/pdf.worker.min.mjs');
    expect(isWorkerConfigured()).toBe(true);
    expect(() => assertWorkerConfigured()).not.toThrow();
    expect(getDocumentParams()).toEqual({
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
    });
  });

  it('manages shared and dedicated pdf workers', () => {
    configurePdfAssets({ workerSrc: '/pdfjs/pdf.worker.min.mjs' });

    const worker1 = createPdfWorker({ name: 'dedicated' });
    expect(worker1).toBeDefined();

    const shared1 = getSharedPdfWorker();
    expect(shared1).toBeDefined();

    const shared2 = getSharedPdfWorker();
    expect(shared2).toBe(shared1);

    destroySharedPdfWorker();
    expect((shared1 as any).destroyed).toBe(true);

    const shared3 = getSharedPdfWorker();
    expect(shared3).toBeDefined();
    expect(shared3).not.toBe(shared1);
    destroySharedPdfWorker();
  });

  it('exports worker functions from index.ts', () => {
    expect(indexExports.createPdfWorker).toBe(createPdfWorker);
    expect(indexExports.getSharedPdfWorker).toBe(getSharedPdfWorker);
    expect(indexExports.destroySharedPdfWorker).toBe(destroySharedPdfWorker);
    expect(indexExports.FetchRangeTransport).toBeDefined();
    expect(indexExports.prepareDocumentLoading).toBeDefined();
  });
});
