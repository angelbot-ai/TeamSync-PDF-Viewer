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
  | 'underline'
  | 'strikeout'
  | 'squiggly'
  | 'digital_signature_placeholder'
  | 'link'
  /**
   * An annotation imported from XFDF that this viewer cannot edit or render natively (e.g.
   * underline, squiggly, polygon, redaction). It is drawn as a read-only outline at its bounding
   * box and re-exported verbatim (`rawXfdf`) so nothing is lost on a save round-trip.
   */
  | 'opaque';

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
  /** Multi-stroke ink (each stroke a polyline). `points` holds the first stroke for legacy consumers. */
  strokes?: AnnotationPoint[][];
  /** ISO-8601 timestamps (XFDF creationdate / date). */
  createdAt?: string;
  modifiedAt?: string;
  /** Subject / XFDF element name of an opaque annotation (informational). */
  opaqueKind?: string;
  /** Verbatim XFDF element for `opaque` annotations. */
  rawXfdf?: string;
  /**
   * XFDF attributes and child elements this viewer does not model (e.g. Apryse `trn-custom-data`,
   * `defaultappearance`). Preserved on import and re-emitted on export so other viewers keep
   * their metadata across a round-trip.
   */
  xfdfExtras?: {
    attrs?: Record<string, string>;
    children?: string[];
  };
}

export type AnnotationInput = Omit<Annotation, 'id'> & { id?: string };
