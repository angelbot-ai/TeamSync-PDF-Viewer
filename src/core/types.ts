/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Public option and event types.
 */
import type React from 'react';
import type { ViewerPlugin } from '../plugins/types';
import type { Annotation } from '../annotations/types';
import type { AnnotationChangedEvent } from '../annotations/AnnotationManager';
import type { PdfAssetPaths } from './pdfAssets';
import type { WebViewerInstance } from './ViewerInstance';
import type { OfficeConverterConfig, OfficeFileType } from '../office/types';
import type { FormManager } from '../forms/FormManager';
import type { FormField, FormDataRecord, FormAssignee, FormRole, FormFeatureOptions } from '../forms/types';

export type {
  PdfAssetPaths,
  WebViewerInstance,
  OfficeConverterConfig,
  OfficeFileType,
  FormManager,
  FormField,
  FormDataRecord,
  FormAssignee,
  FormRole,
  FormFeatureOptions,
};

export interface SearchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransientHighlight {
  id?: string;
  /** 1-based page number */
  pageIndex: number;
  /** Bounding boxes on the page in PDF coordinate points */
  bounds: SearchBounds[];
  /** Background fill color (default 'rgba(250, 204, 21, 0.4)') */
  color?: string;
  /** Border color (default 'rgba(234, 179, 8, 0.8)') */
  borderColor?: string;
  /** Whether to animate with a pulsing focus ring */
  pulse?: boolean;
  /** Optional tooltip text displayed above the highlight */
  tooltip?: string;
}

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
  /** Allow designing / creating form fields in the Forms builder tab (default true). */
  canCreateForms?: boolean;
  /** Allow filling interactive form fields in the View tab (default true). */
  canFillForms?: boolean;
}

export interface ViewerUser {
  id: string;
  name: string;
  /** Optional email address of the user */
  email?: string;
  /** Form template role fulfilled by this user on the document (e.g. 'applicant', 'tenant', 'user_a') */
  role?: string;
  /** Alias of role */
  roleId?: string;
  /** User visual accent color */
  color?: string;
}

export type InitialScale = number | 'fit-width' | 'fit-page' | { type: 'fit-width'; ratio?: number };

export type ToolMode =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggly'
  | 'text'
  | 'eraser'
  | 'note'
  | 'callout'
  | 'signature'
  | 'digital_signature'
  | 'link'
  | 'redaction'
  | null;

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
  /**
   * Initial page width target as a ratio of the available viewing container width (e.g. `0.7` for 70%).
   * When provided, the viewer scales the document to occupy this fraction of available width on initial render.
   */
  initialWidthRatio?: number;
  /** Alias of `initialWidthRatio`. */
  widthRatio?: number;
  /**
   * Automatically re-calculate scale when the viewer container or window resizes while in a fit or width-ratio mode.
   * Default: true.
   */
  responsive?: boolean;
  /** 1-based page to scroll to after load. */
  initialPage?: number;
  /** Current 1-based page to display. Changes navigate to the given page. */
  page?: number;
  /** Transient visual highlights that render on pages without polluting AnnotationManager. */
  transientHighlights?: TransientHighlight[];
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
  /** Custom or pre-populated FormManager instance. */
  formManager?: FormManager;
  /**
   * Form feature visibility and user interaction controls (e.g. allowUserSwitching, showSignatureFlags,
   * showFlowNavigation, otherUserFieldsMode, etc.).
   */
  formOptions?: FormFeatureOptions;
  /**
   * The active form role ID (e.g. 'applicant', 'tenant', 'landlord').
   * Controls which fields and signature flags are interactive/visible for this role.
   */
  currentRole?: string | null;
  /** Alias of `currentRole`. */
  currentFormAssignee?: string | null;
  /** Custom list of form template roles. */
  formRoles?: FormRole[];
  /** Alias of `formRoles`. */
  formAssignees?: FormAssignee[];
  /** Pre-populated form fields schema. */
  formFields?: FormField[];
  /** Pre-filled form values record. */
  formData?: FormDataRecord;
  /** Shorthand for "no annotation/redaction editing at all". */
  readOnly?: boolean;
  /**
   * Actual user details passed by the host application (name, email, role, etc.).
   * If user has a `role` property, the viewer automatically activates that role for form filling.
   */
  actualUser?: ViewerUser;
  /** Author attached to annotations created in this viewer, and current user details. */
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
  /**
   * Hide SVG annotation overlays and transient highlights until the underlying page canvas has finished rendering.
   * Prevents annotations from rendering over a blank white page container on initial load, scroll, or fit re-render.
   * Default true.
   */
  hideAnnotationsUntilPageRendered?: boolean;
  /** Allow selecting text from PDF pages (default true). */
  enableTextSelection?: boolean;
  /** Initial tool mode on load. Defaults to 'select'. */
  defaultTool?: 'select' | 'pan';
  /** Show floating quick-action copy badge above selected text (default true). */
  showSelectionTooltip?: boolean;
  /** Fires whenever pending or applied redactions change in the viewer. */
  onRedactionsChange?: (redactions: Redaction[]) => void;
  /** Fires once per user click of Apply in the confirmation modal with all applied redactions. */
  onRedactionsApplied?: (redactions: Redaction[]) => void;
  /**
   * Configuration for viewing Microsoft Office documents (.docx, .doc, .pptx, .ppt, .xlsx, .xls).
   * Supports headless backend conversion (Gotenberg / LibreOffice daemon) or custom conversion hooks.
   */
  officeConverter?: OfficeConverterConfig;
  /**
   * Unique identifier for this viewer instance, allowing other viewers to target it by name.
   */
  id?: string;
  /**
   * Target viewer instance, ref, getter, or instance ID to open cross-document links in.
   * When a link annotation pointing to another PDF is clicked, the document will automatically
   * be loaded and navigated in this target viewer instance.
   */
  targetViewer?:
    | WebViewerInstance
    | React.RefObject<WebViewerInstance | null>
    | (() => WebViewerInstance | null)
    | string;
  /**
   * Optional custom resolver for cross-document links.
   * Allows transforming relative filenames, document IDs, or URNs into full fetchable document URLs or target pages.
   */
  resolveLinkUrl?: (
    linkUrl: string,
    context: { sourceViewer: WebViewerInstance; annotation?: Annotation }
  ) => string | { url: string; page?: number } | Promise<string | { url: string; page?: number } | null> | null;
  /**
   * Fires when a link annotation or embedded PDF link is clicked.
   * Call `event.preventDefault()` to suppress default behavior.
   */
  onLinkClick?: (event: LinkClickEvent) => boolean | void | Promise<void>;
}

/** Details provided when a link annotation or embedded PDF link is clicked. */
export interface LinkClickEvent {
  /** The raw link URL or target string. */
  url: string;
  /** Target document URL if the link points to a document (clean without page hash). */
  docUrl?: string;
  /** Target page number (1-based), if specified in the link. */
  pageNumber?: number;
  /** True if the link points to an internal page in the current document. */
  isInternalPage: boolean;
  /** The annotation object if clicked from a link annotation. */
  annotation?: Annotation;
  /** Original mouse event if triggered by user interaction. */
  originalEvent?: React.MouseEvent;
  /** Calling this prevents default behavior (e.g. scrolling current document, auto-forwarding to targetViewer, or opening window.open). */
  preventDefault: () => void;
  /** Whether preventDefault() was called. */
  readonly defaultPrevented: boolean;
}

/** Events available through `instance.on(type, listener)`. */
export interface ViewerEventMap {
  documentLoaded: { url: string; numPages: number };
  documentLoadError: { url: string; error: Error; passwordRequired: boolean };
  firstPageRendered: { url: string; pageNumber: number };
  pageRendered: { url: string; pageNumber: number };
  pageChanged: { pageNumber: number; numPages: number };
  annotationsChanged: { annotations: Annotation[] };
  /** Granular add / modify / delete (with the `imported` flag) from the AnnotationManager. */
  annotationChanged: AnnotationChangedEvent;
  redactionsChanged: { redactions: Redaction[] };
  redactionsApplied: { redactions: Redaction[] };
  transientHighlightsChanged: { highlights: TransientHighlight[] };
  toolChanged: { tool: string | null };
  textSelected: { text: string };
  textCopied: { text: string };
  linkClicked: LinkClickEvent;
  /** Fires when an Office document begins conversion. */
  officeConverting: { fileType: OfficeFileType; url?: string; fileName?: string };
  /** Fires when an Office document finishes conversion successfully. */
  officeConverted: { fileType: OfficeFileType; url?: string; fromCache: boolean };
  /** Fires when an Office document conversion fails. */
  officeConversionError: { fileType: OfficeFileType; error: Error; url?: string };
  destroy: Record<string, never>;
}

export type ViewerEventType = keyof ViewerEventMap;
