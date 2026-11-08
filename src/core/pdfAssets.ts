/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * pdf.js asset configuration.
 *
 * The library never bundles or inlines the pdf.js worker (that produced a 5 MB bundle with a
 * `data:` URL worker, which strict Content-Security-Policies reject). Hosts serve the worker,
 * CMaps, standard fonts and wasm decoders from their own origin and tell us where they live.
 *
 * Next.js example (copy from node_modules/pdfjs-dist into public/pdfjs/):
 *   configurePdfAssets({
 *     workerSrc: '/pdfjs/pdf.worker.min.mjs',
 *     cMapUrl: '/pdfjs/cmaps/',
 *     standardFontDataUrl: '/pdfjs/standard_fonts/',
 *     wasmUrl: '/pdfjs/wasm/',
 *   });
 *
 * Vite example:
 *   import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
 *   configurePdfAssets({ workerSrc });
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

export interface PdfAssetPaths {
  /** URL of `pdf.worker.min.mjs` matching the installed pdfjs-dist version. REQUIRED. */
  workerSrc?: string;
  /** Directory URL (trailing slash) of the packed CMaps — needed for CJK/Indic text. */
  cMapUrl?: string;
  /** Directory URL (trailing slash) of the standard 14 font substitutes. */
  standardFontDataUrl?: string;
  /** Directory URL (trailing slash) of the wasm decoders (JPX/OpenJPEG, qcms). */
  wasmUrl?: string;
  /** Directory URL (trailing slash) of ICC profiles. */
  iccUrl?: string;
}

let configured: PdfAssetPaths = {};

export function configurePdfAssets(paths: PdfAssetPaths): void {
  configured = { ...configured, ...paths };
  if (paths.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = paths.workerSrc;
  }
}

export function getPdfAssetPaths(): Readonly<PdfAssetPaths> {
  return configured;
}

/** True once a worker URL has been configured (either via configurePdfAssets or directly on pdf.js). */
export function isWorkerConfigured(): boolean {
  return Boolean(configured.workerSrc || pdfjsLib.GlobalWorkerOptions.workerSrc);
}

/**
 * Throws a descriptive error when the worker has not been configured. Called lazily right before
 * the first `getDocument()` — never at module scope, so importing the package is side-effect free
 * and safe under SSR.
 */
export function assertWorkerConfigured(): void {
  if (isWorkerConfigured()) return;
  throw new Error(
    '[teamsync-pdf-viewer] pdf.js worker not configured. Call configurePdfAssets({ workerSrc }) ' +
      'with the URL of pdf.worker.min.mjs (same pdfjs-dist version) before loading a document, or ' +
      'pass `assets={{ workerSrc }}` to <TeamSyncViewer>.'
  );
}

/** Extra `getDocument()` parameters derived from the configured asset paths. */
export function getDocumentParams(): Partial<DocumentInitParameters> {
  const params: Partial<DocumentInitParameters> = {};
  if (configured.cMapUrl) {
    params.cMapUrl = configured.cMapUrl;
    params.cMapPacked = true;
  }
  if (configured.standardFontDataUrl) params.standardFontDataUrl = configured.standardFontDataUrl;
  if (configured.wasmUrl) params.wasmUrl = configured.wasmUrl;
  if (configured.iccUrl) params.iccUrl = configured.iccUrl;
  return params;
}

/** pdfjs-dist version this build was compiled against (useful for worker-version mismatch checks). */
export const pdfjsVersion: string = pdfjsLib.version;

export type PDFWorker = pdfjsLib.PDFWorker;

let sharedWorker: pdfjsLib.PDFWorker | null = null;

/**
 * Creates a new dedicated pdf.js worker instance.
 * Useful for host applications that pre-warm the worker thread during idle periods.
 */
export function createPdfWorker(params?: { name?: string; port?: any; verbosity?: number }): pdfjsLib.PDFWorker {
  assertWorkerConfigured();
  try {
    const workerCtor = (pdfjsLib as any).PDFWorker;
    if (typeof workerCtor === 'function') {
      return new workerCtor(params);
    }
  } catch {}
  return {} as any;
}

/**
 * Returns a shared library-level pdf.js worker singleton.
 * Self-healing: if the worker was destroyed or terminated, instantiates a fresh worker instance.
 */
export function getSharedPdfWorker(): pdfjsLib.PDFWorker | undefined {
  if (!isWorkerConfigured()) return undefined;
  try {
    const workerCtor = (pdfjsLib as any).PDFWorker;
    if (typeof workerCtor !== 'function') return undefined;
    if (!sharedWorker || (sharedWorker as any).destroyed) {
      sharedWorker = new workerCtor();
    }
    return sharedWorker || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Destroys the shared library-level pdf.js worker singleton, releasing its worker thread.
 */
export function destroySharedPdfWorker(): void {
  if (sharedWorker) {
    try {
      sharedWorker.destroy();
    } catch {}
    sharedWorker = null;
  }
}

