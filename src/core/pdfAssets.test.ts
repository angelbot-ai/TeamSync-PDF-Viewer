import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '6.2.108',
}));

import * as pdfjsLib from 'pdfjs-dist';
import { assertWorkerConfigured, configurePdfAssets, getDocumentParams, isWorkerConfigured } from './pdfAssets';

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
});
