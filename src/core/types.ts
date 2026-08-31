/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Public option and event types.
 */
import type { ViewerPlugin } from '../plugins/types';
import type { Annotation } from '../annotations/types';
import type { AnnotationChangedEvent } from '../annotations/AnnotationManager';
import type { PdfAssetPaths } from './pdfAssets';

export type { PdfAssetPaths };

export interface Redaction {
  id?: string;
  /** 1-based page number */
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: 'pending' | 'applied';
}

export interface WatermarkOptions {
  text: string;
  opacity?: number;
  size?: number;
  mode?: 'single' | 'tiled';
  color?: string;
}

export interface SDKPermissions {
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;
  canRedact?: boolean;
  /** Allow editing/deleting annotations authored by other users (default false). */
  canEditOthers?: boolean;
}

export interface ViewerUser {
  id: string;
  name: string;
}

export type InitialScale = number | 'fit-width' | 'fit-page';

/**
 * Options accepted by `createWebViewer()` (and the deprecated `WebViewer()` alias).
 * Every option is also available as a prop on `<TeamSyncViewer>`.
 */
export interface WebViewerOptions {
  /** @deprecated Only meaningful for the iframe package (`public/webviewer.js`). */
  path?: string;
  /** URL of the PDF to load. Presigned/CORS-enabled URLs work; bytes are fetched by pdf.js. */
  initialDoc?: string;
  /** Display name used for downloads. */
  fileName?: string;
  initialScale?: InitialScale;
  /** 1-based page to scroll to after load. */
  initialPage?: number;
  plugins?: ViewerPlugin[];
  redactions?: Redaction[];
  regexRedactions?: RegExp[];
  enableAnnotations?: boolean;
  enableSign?: boolean;
  signOptions?: ('digital' | 'ades' | 'simple')[];
  watermark?: WatermarkOptions;
  permissions?: SDKPermissions;
  enableRedactions?: boolean;
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;
  /** Shorthand for "no annotation/redaction editing at all". */
  readOnly?: boolean;
  /** Author attached to annotations created in this viewer. */
  currentUser?: ViewerUser;
  /** pdf.js worker / CMap / font / wasm locations (see `configurePdfAssets`). */
  assets?: PdfAssetPaths;
  /** Send cookies with the document request (same-origin session-bound URLs). Default false. */
  withCredentials?: boolean;
  /** Render the top toolbar. Default true. */
  toolbar?: boolean;
  /** Render the left (thumbnails) and right (comments/search) panels. Default true. */
  sidebars?: boolean;
  /** Start with the thumbnails panel open. Default true. */
  leftPanelOpen?: boolean;
  /** Focus the viewer on mount so keyboard shortcuts work immediately. Default false. */
  autoFocus?: boolean;
}

/** Events available through `instance.on(type, listener)`. */
export interface ViewerEventMap {
  documentLoaded: { url: string; numPages: number };
  documentLoadError: { url: string; error: Error; passwordRequired: boolean };
  firstPageRendered: { url: string; pageNumber: number };
  pageChanged: { pageNumber: number; numPages: number };
  annotationsChanged: { annotations: Annotation[] };
  /** Granular add / modify / delete (with the `imported` flag) from the AnnotationManager. */
  annotationChanged: AnnotationChangedEvent;
  toolChanged: { tool: string | null };
  destroy: Record<string, never>;
}

export type ViewerEventType = keyof ViewerEventMap;
