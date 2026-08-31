/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * TeamSync PDF Viewer SDK — public entry point.
 *
 * This module is side-effect free: importing it never touches `window`/`document`, so it is safe
 * to import under SSR. Mount with `createWebViewer()` or render `<TeamSyncViewer>` on the client.
 */
export { createWebViewer, WebViewer } from './core/createWebViewer';
export { WebViewerInstance } from './core/ViewerInstance';
export { TeamSyncViewer } from './components/TeamSyncViewer';
export type { TeamSyncViewerProps } from './components/TeamSyncViewer';
export { configurePdfAssets, getPdfAssetPaths, isWorkerConfigured, pdfjsVersion } from './core/pdfAssets';
export type { PdfAssetPaths } from './core/pdfAssets';
export { ViewerBus } from './core/eventBus';
export type { BusListener } from './core/eventBus';
export { buildPdfBytes, MAX_EXPORT_BYTES } from './core/export';
export type { ExportInput, ExportOptions } from './core/export';
export type {
  WebViewerOptions,
  Redaction,
  WatermarkOptions,
  SDKPermissions,
  ViewerUser,
  InitialScale,
  ViewerEventMap,
  ViewerEventType,
} from './core/types';
export type { Annotation, AnnotationType, AnnotationPoint } from './annotations/types';
export * from './plugins/types';
