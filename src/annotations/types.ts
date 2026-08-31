/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Annotation data model.
 *
 * Coordinates are in "base page space": the pdf.js viewport at scale 1 with the page's intrinsic
 * /Rotate applied (top-left origin, PDF points). UI rotation applied by the viewer is composed on
 * top of this space at render time, so stored annotations are independent of the current view.
 */

export type AnnotationType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'note'
  | 'callout'
  | 'signature'
  | 'highlight'
  | 'digital_signature_placeholder'
  | 'link';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  /** 1-based page number */
  pageIndex: number;
  type: AnnotationType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  points?: AnnotationPoint[];
  rects?: { x: number; y: number; width: number; height: number }[];
  color: string;
  strokeWidth: number;
  opacity: number;
  imageUrl?: string;
  timestamp?: number;
  signer?: string;
  signType?: 'advanced' | 'simple';
  linkUrl?: string;
  /** Display name of the author (set from `currentUser` when created in-viewer). */
  author?: string;
  /** Stable author identifier (opaque to the viewer). */
  authorId?: string;
  /** When true the annotation cannot be moved, edited or deleted in the UI. */
  readOnly?: boolean;
}
