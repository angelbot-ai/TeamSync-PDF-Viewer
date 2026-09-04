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
export * from './types/compare';
export * from './utils/pdfDiffEngine';
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
export type { Annotation, AnnotationType, AnnotationPoint, AnnotationInput } from './annotations/types';
export { AnnotationManager } from './annotations/AnnotationManager';
export type { AnnotationAction, AnnotationChangedEvent, CommitOptions, ViewerUserInfo } from './annotations/AnnotationManager';
export { newAnnotationId } from './annotations/ids';
export {
  createPageGeometry,
  geometryFromPage,
  createGeometryResolver,
  toPdfPoint,
  fromPdfPoint,
  rectToPdf,
  rectFromPdf,
  rectToQuadPoints,
  quadPointsToRects,
} from './annotations/geometry';
export type { PageGeometry, GeometryResolver, PdfRect, Rect, Point } from './annotations/geometry';
export { annotationsToXfdf, annotationToXfdfFragment, parseXfdf, toPdfDate, fromPdfDate, XFDF_NS } from './annotations/xfdf';
export type { XfdfExportOptions } from './annotations/xfdf';
export { printPdfBytes } from './core/print';
export type { PrintOptions } from './core/print';
export { usePdfSearch, searchPdfText } from './hooks/usePdfSearch';
export type { SearchResult, SearchBounds } from './hooks/usePdfSearch';
export type { TransientHighlight } from './core/types';
export { MIN_SCALE, MAX_SCALE, clampScale, calculateNextZoomIn, calculateNextZoomOut, calculateScrollCompensation } from './utils/zoomUtils';
export type { ScrollCompensationParams, ScrollPosition } from './utils/zoomUtils';
export { estimatePageDimensions, computeRowLayout, DEFAULT_FALLBACK_DIMS, hasDimensionMismatch } from './utils/layoutUtils';
export type { PageDimension, RowLayout } from './utils/layoutUtils';
export * from './plugins/types';
