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
