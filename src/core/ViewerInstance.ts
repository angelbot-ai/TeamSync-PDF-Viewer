/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * WebViewerInstance — the imperative handle returned by `createWebViewer()` and exposed through
 * `<TeamSyncViewer ref>`. Keeps the legacy `UI` / `Core` facade for drop-in compatibility.
 */
import type React from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import { ViewerBus } from './eventBus';
import { buildPdfBytes, type ExportOptions } from './export';
import type { Annotation } from '../annotations/types';
import { AnnotationManager } from '../annotations/AnnotationManager';
import { createGeometryResolver } from '../annotations/geometry';
import type { Redaction, WatermarkOptions, ViewerEventMap, ViewerEventType, TransientHighlight } from './types';
import { searchPdfText, type SearchResult } from '../hooks/usePdfSearch';
import { copyTextToClipboard } from '../utils/clipboardUtils';
import { FormManager } from '../forms/FormManager';
import type {
  FormField,
  FormDataRecord,
  FormValidationResult,
  FormAssignee,
  FormFeatureOptions,
} from '../forms/types';

/** Callbacks the React component installs so the instance can reach live state. */
export interface ViewerBinding {
  getAnnotations(): Annotation[];
  getRedactions(): Redaction[];
  getWatermark(): WatermarkOptions | undefined;
  getPdfDocument(): pdfjsLib.PDFDocumentProxy | null;
  getDocumentUrl(): string | undefined;
  getFileName(): string | undefined;
  getCurrentUserName(): string | undefined;
  getCurrentPage(): number;
  getPageCount(): number;
  loadDocument(url: string): void;
  goToPage(pageNumber: number, options?: { smooth?: boolean }): void;
  getTransientHighlights(): TransientHighlight[];
  setTransientHighlights(highlights: TransientHighlight[]): void;
}

const noBinding = (): never => {
  throw new Error('[teamsync-pdf-viewer] viewer is not mounted (was destroy() called?)');
};

export class WebViewerInstance {
  private static instances = new Map<string, WebViewerInstance>();

  /** Retrieve a registered WebViewerInstance by its ID. */
  static getInstance(id: string): WebViewerInstance | undefined {
    return WebViewerInstance.instances.get(id);
  }

  /** Register a WebViewerInstance with an ID. */
  static registerInstance(id: string, instance: WebViewerInstance): void {
    WebViewerInstance.instances.set(id, instance);
  }

  /** Unregister an instance by its ID. */
  static unregisterInstance(id: string): void {
    WebViewerInstance.instances.delete(id);
  }

  /** Clear all registered instances (primarily for testing). */
  static clearInstances(): void {
    WebViewerInstance.instances.clear();
  }

  readonly bus: ViewerBus;
  /** Annotation list, history, permissions and XFDF import/export. */
  readonly annotationManager: AnnotationManager;
  /** Form fields schema, values, validation, and history. */
  readonly formManager: FormManager;
  /** Root element of the viewer once mounted. */
  element: HTMLElement | null = null;
  /** Unique identifier for this instance. */
  id?: string;

  private binding: ViewerBinding | null = null;
  private unmountRoot: (() => void) | null = null;
  private destroyed = false;
  private targetViewerTarget:
    | WebViewerInstance
    | React.RefObject<WebViewerInstance | null>
    | (() => WebViewerInstance | null)
    | string
    | null = null;

  constructor(
    bus: ViewerBus,
    annotationManager: AnnotationManager = new AnnotationManager(),
    id?: string,
    formManager: FormManager = new FormManager()
  ) {
    this.bus = bus;
    this.annotationManager = annotationManager;
    this.formManager = formManager;
    if (id) {
      this.id = id;
      WebViewerInstance.registerInstance(id, this);
    }
  }

  /** Sets the target viewer instance, ref, getter, or ID to receive cross-document links. */
  setTargetViewer(
    target:
      | WebViewerInstance
      | React.RefObject<WebViewerInstance | null>
      | (() => WebViewerInstance | null)
      | string
      | null
  ): void {
    this.targetViewerTarget = target;
  }

  /** Resolves the target viewer instance if configured. */
  getTargetViewer(): WebViewerInstance | null {
    const t = this.targetViewerTarget;
    if (!t) return null;
    if (typeof t === 'string') {
      return WebViewerInstance.getInstance(t) ?? null;
    }
    if (typeof t === 'function') {
      return t();
    }
    if (typeof t === 'object' && 'current' in t) {
      return t.current;
    }
    return t;
  }

  // ---- lifecycle -------------------------------------------------------------------------

  /** @internal */
  _bind(binding: ViewerBinding, element: HTMLElement | null): void {
    this.binding = binding;
    this.element = element;
  }

  /** @internal */
  _unbind(): void {
    this.binding = null;
  }

  /** @internal — installed by createWebViewer() so destroy() can unmount the React root. */
  _setUnmount(fn: () => void): void {
    this.unmountRoot = fn;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get isMounted(): boolean {
    return this.binding !== null;
  }

  /**
   * Tear the viewer down: unmounts the React tree created by `createWebViewer()`, drops every
   * listener and refuses further use. Safe to call twice.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.id) {
      WebViewerInstance.unregisterInstance(this.id);
    }
    try {
      this.bus.emit('destroy', {});
    } finally {
      const unmount = this.unmountRoot;
      this.unmountRoot = null;
      this.binding = null;
      this.element = null;
      this.bus.destroy();
      if (unmount) {
        // React refuses synchronous unmounts from inside its own render/commit phase.
        Promise.resolve().then(unmount);
      }
    }
  }

  // ---- events ----------------------------------------------------------------------------

  on<K extends ViewerEventType>(type: K, listener: (detail: ViewerEventMap[K]) => void): () => void {
    return this.bus.on(type, listener as (d: unknown) => void);
  }

  off<K extends ViewerEventType>(type: K, listener: (detail: ViewerEventMap[K]) => void): void {
    this.bus.off(type, listener as (d: unknown) => void);
  }

  // ---- document --------------------------------------------------------------------------

  /** Load (or reload) a document by URL. Resolves when loaded, rejects on load error. */
  loadDocument(
    url: string,
    options?: { page?: number; initialPage?: number }
  ): Promise<{ url: string; numPages: number }> {
    const b = this.binding ?? noBinding();
    const targetPage = options?.page ?? options?.initialPage;
    return new Promise((resolve, reject) => {
      const offLoaded = this.bus.on<ViewerEventMap['documentLoaded']>('documentLoaded', (d) => {
        if (d.url !== url) return;
        cleanup();
        if (targetPage && targetPage > 0) {
          setTimeout(() => {
            try {
              this.goToPage(targetPage, { smooth: true });
            } catch {}
          }, 50);
        }
        resolve(d);
      });
      const offError = this.bus.on<ViewerEventMap['documentLoadError']>('documentLoadError', (d) => {
        if (d.url !== url) return;
        cleanup();
        reject(d.error);
      });
      const cleanup = () => {
        offLoaded();
        offError();
      };
      b.loadDocument(url);
    });
  }

  /**
   * Loads a document or navigates to a page within it. If the document is already loaded,
   * directly navigates to the requested page without reloading.
   */
  async loadOrNavigate(
    url: string,
    options?: { page?: number; initialPage?: number }
  ): Promise<{ url: string; numPages: number } | void> {
    const targetPage = options?.page ?? options?.initialPage;
    if (this.getDocumentUrl() === url) {
      if (targetPage && targetPage > 0) {
        this.goToPage(targetPage, { smooth: true });
      }
      return;
    }
    return this.loadDocument(url, options);
  }

  /**
   * Programmatically trigger link following for a given link URL or target,
   * routing through targetViewer or opening appropriately.
   */
  openLink(linkUrl: string): void {
    this.bus.emit('action-open-link', { url: linkUrl });
  }

  getDocumentUrl(): string | undefined {
    return this.binding?.getDocumentUrl();
  }

  getPdfDocument(): pdfjsLib.PDFDocumentProxy | null {
    return this.binding?.getPdfDocument() ?? null;
  }

  getCurrentPage(): number {
    return this.binding?.getCurrentPage() ?? 0;
  }

  getPageCount(): number {
    return this.binding?.getPageCount() ?? 0;
  }

  /** Navigate to a specific page number (1-based). */
  goToPage(pageNumber: number, options: { smooth?: boolean } = {}): void {
    const b = this.binding;
    if (b) {
      b.goToPage(pageNumber, options);
    } else {
      this.bus.emit('action-go-to-page', { page: pageNumber, smooth: options.smooth });
    }
  }

  /** Set the current page number (1-based). Alias of goToPage. */
  setCurrentPage(pageNumber: number): void {
    this.goToPage(pageNumber);
  }

  /**
   * Scale the document to fit the container width.
   *
   * @param ratio - Optional width ratio fraction (e.g. `0.7` for 70% of available width).
   *   Defaults to `1.0` (100% full-width fit).
   */
  fitWidth(ratio?: number): void {
    this.bus.emit('action-fit-to-width', typeof ratio === 'number' ? { ratio } : undefined);
  }

  /** Alias of `fitWidth`. */
  fitToWidth(ratio?: number): void {
    this.fitWidth(ratio);
  }

  /** Scale the document to fit the entire page within the container viewport. */
  fitPage(): void {
    this.bus.emit('action-fit-to-page');
  }

  /** Alias of `fitPage`. */
  fitToPage(): void {
    this.fitPage();
  }

  /**
   * Search the document for text matches, returning snippets and page bounding boxes.
   *
   * @param query - Search term.
   * @param options - Search options:
   *   - `pages`: Specific 1-based page numbers to search. Defaults to all pages.
   */
  async searchText(query: string, options: { pages?: number[] } = {}): Promise<SearchResult[]> {
    const pdf = this.getPdfDocument();
    if (!pdf) return [];
    const b = this.binding;
    const redactions = b ? b.getRedactions() : [];
    return searchPdfText(pdf, query, redactions, undefined, options.pages);
  }

  // ---- transient highlights (citations, search matches) -----------------------------------

  /** Get the current list of transient highlights. */
  getTransientHighlights(): TransientHighlight[] {
    return this.binding?.getTransientHighlights() ?? [];
  }

  /**
   * Set transient visual highlights across one or more pages.
   * These render directly on the PDF canvas but are NEVER saved into AnnotationManager
   * or exported to XFDF.
   */
  setTransientHighlights(highlights: TransientHighlight[]): void {
    const b = this.binding;
    if (b) {
      b.setTransientHighlights(highlights);
    } else {
      this.bus.emit('action-set-transient-highlights', { highlights });
    }
    this.bus.emit('transientHighlightsChanged', { highlights });
  }

  /** Add a single transient highlight to the current list. */
  addTransientHighlight(highlight: TransientHighlight): void {
    const current = this.getTransientHighlights();
    this.setTransientHighlights([...current, highlight]);
  }

  /** Clear all active transient highlights. */
  clearTransientHighlights(): void {
    this.setTransientHighlights([]);
  }

  /**
   * Search for a snippet or citation query, scroll to its page, and highlight it temporarily.
   * Returns the matched SearchResult or null if not found.
   *
   * @param query - The text snippet to locate and highlight.
   * @param options - Navigation and display options:
   *   - `pageIndex`: Preferred page (1-based). When `scope: 'page'`, restricts search to this page.
   *   - `scope`: Search scope. `'document'` (default) searches all pages, keeping `pageIndex` as a preference.
   *     `'page'` restricts the search strictly to `pageIndex` (avoids full-document walk).
   *     If `scope: 'page'` is provided without `pageIndex`, it gracefully degrades to `'document'`.
   *   - `pulse`: Animate focus ring (default true).
   *   - `scrollTo`: Scroll page into view (default true).
   *   - `color`: Background highlight color.
   *   - `tooltip`: Tooltip text above the highlight (defaults to matched snippet).
   */
  async highlightSnippet(
    query: string,
    options: {
      pageIndex?: number;
      scope?: 'document' | 'page';
      pulse?: boolean;
      scrollTo?: boolean;
      color?: string;
      tooltip?: string;
    } = {}
  ): Promise<SearchResult | null> {
    const searchOptions: { pages?: number[] } = {};
    if (options.scope === 'page' && options.pageIndex) {
      searchOptions.pages = [options.pageIndex];
    }
    const results = await this.searchText(query, searchOptions);
    let match = results[0];
    if (options.pageIndex) {
      match = results.find(r => r.pageIndex === options.pageIndex) || match;
    }
    if (!match) return null;

    const highlight: TransientHighlight = {
      id: match.id,
      pageIndex: match.pageIndex,
      bounds: match.bounds,
      color: options.color || 'rgba(250, 204, 21, 0.45)',
      borderColor: 'rgba(234, 179, 8, 0.85)',
      pulse: options.pulse !== false,
      tooltip: options.tooltip || match.snippet,
    };

    this.setTransientHighlights([highlight]);

    if (options.scrollTo !== false) {
      this.goToPage(match.pageIndex, { smooth: true });
    }

    return match;
  }

  // ---- annotations / export --------------------------------------------------------------

  getAnnotations(): Annotation[] {
    return this.annotationManager.getAnnotationsList();
  }

  /** Get the current list of redactions (pending and applied). */
  getRedactions(): Redaction[] {
    return this.binding?.getRedactions() ?? [];
  }

  /** Print the exported document (annotations, redactions and watermark baked in). */
  print(): void {
    this.bus.emit('action-print');
  }

  // ---- Forms API ------------------------------------------------------------------------

  /** Returns all defined form fields across all pages. */
  getFormFields(): FormField[] {
    return this.formManager.getFields();
  }

  /** Sets the form fields schema. */
  setFormFields(fields: FormField[]): void {
    this.formManager.setFields(fields);
  }

  /** Returns current filled form data values. */
  getFormData(): FormDataRecord {
    return this.formManager.getValues();
  }

  /** Sets current filled form data values. */
  setFormData(data: FormDataRecord): void {
    this.formManager.setValues(data);
  }

  /** Clears all filled form data values. */
  clearFormData(): void {
    this.formManager.clearValues();
  }

  /** Validates all required form fields (or only those assigned to the specified user). */
  validateForm(assigneeId?: string | null): FormValidationResult {
    return this.formManager.validate(assigneeId);
  }

  /** Exports filled form data as a JSON string. */
  async exportFormData(_format: 'json' = 'json'): Promise<string> {
    return this.formManager.exportDataJson();
  }

  /** Imports form data from a record object or JSON string. */
  importFormData(data: FormDataRecord | string): void {
    if (typeof data === 'string') {
      this.formManager.importDataJson(data);
    } else {
      this.formManager.setValues(data);
    }
  }

  /** Returns all configured form assignees. */
  getFormAssignees(): FormAssignee[] {
    return this.formManager.getAssignees();
  }

  /** Sets the list of form assignees. */
  setFormAssignees(assignees: FormAssignee[]): void {
    this.formManager.setAssignees(assignees);
  }

  /** Adds a new form assignee/user. */
  addFormAssignee(assignee: FormAssignee): void {
    this.formManager.addAssignee(assignee);
  }

  /** Updates an existing form assignee. */
  updateFormAssignee(id: string, updates: Partial<Omit<FormAssignee, 'id'>>): void {
    this.formManager.updateAssignee(id, updates);
  }

  /** Removes a form assignee and unassigns any fields bound to them. */
  removeFormAssignee(id: string): void {
    this.formManager.removeAssignee(id);
  }

  /** Returns the active form assignee ID (or null for all). */
  getCurrentFormAssignee(): string | null {
    return this.formManager.getCurrentAssignee();
  }

  /** Sets the active form assignee ID (or null for all). */
  setCurrentFormAssignee(assigneeId: string | null): void {
    this.formManager.setCurrentAssignee(assigneeId);
  }

  /**
   * Programmatically sets the active form user for filler mode.
   * Can be an assignee ID string, or a user object { id, name, color? }.
   * Automatically adds the user to the form assignees list if not already present.
   */
  setFormUser(user: { id: string; name?: string; color?: string } | string | null): void {
    this.formManager.setUser(user);
  }

  /** Returns the active form user record, if assigned. */
  getFormUser(): FormAssignee | undefined {
    return this.formManager.getUser();
  }

  /** Returns current form feature options and visibility rules. */
  getFormOptions(): FormFeatureOptions {
    return this.formManager.getOptions();
  }

  /**
   * Programmatically sets form feature options.
   * Controls what form features are visible and interactive for the user
   * (e.g. allowUserSwitching, showSignatureFlags, showFlowNavigation, otherUserFieldsMode, etc.).
   */
  setFormOptions(options: Partial<FormFeatureOptions>): void {
    this.formManager.setOptions(options);
  }

  /** Advances focus to the next form field in the sequence. */
  nextFormField(assigneeId?: string | null): FormField | null {
    return this.formManager.goToNextField(assigneeId);
  }

  /** Moves focus to the previous form field in the sequence. */
  previousFormField(assigneeId?: string | null): FormField | null {
    return this.formManager.goToPreviousField(assigneeId);
  }

  /** Focuses a specific form field by ID. */
  focusFormField(fieldId: string): void {
    this.formManager.setActiveFieldId(fieldId);
  }

  /**
   * Build the exported PDF (annotations + watermark baked, redacted pages rasterized).
   * Uses the bytes of the loaded document; never re-fetches the URL.
   */
  async getFileData(options: ExportOptions = {}): Promise<Uint8Array> {
    const b = this.binding ?? noBinding();
    const pdf = b.getPdfDocument();
    const url = b.getDocumentUrl();
    if (!pdf && !url) throw new Error('No document loaded');

    const getSourceBytes = async () => {
      if (pdf) return pdf.getData();
      const response = await fetch(url as string);
      if (!response.ok) throw new Error(`Failed to fetch document (${response.status})`);
      return response.arrayBuffer();
    };

    return buildPdfBytes(
      {
        getSourceBytes,
        getPageGeometry: pdf ? createGeometryResolver(pdf) : undefined,
        annotations: this.annotationManager.getAnnotationsList(),
        redactions: b.getRedactions(),
        watermark: b.getWatermark(),
        signerName: b.getCurrentUserName(),
        formFields: this.formManager.getFields(),
        formData: this.formManager.getValues(),
      },
      options
    );
  }

  /**
   * Returns the currently selected text string from the document viewer, or an empty string if nothing is selected.
   */
  getSelectedText(): string {
    if (typeof window === 'undefined') return '';
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
  }

  /**
   * Copies the currently selected text to the system clipboard.
   * Resolves to true if copying succeeded, false otherwise.
   */
  async copySelectedText(): Promise<boolean> {
    const text = this.getSelectedText();
    if (!text) return false;
    const success = await copyTextToClipboard(text);
    if (success) {
      this.bus.emit('textCopied', { text });
    }
    return success;
  }

  // ---- legacy facade ---------------------------------------------------------------------

  readonly UI = {
    /** Theming is not implemented; kept for API compatibility. */
    setTheme: (_theme: string) => {},
    goToPage: (pageNumber: number) => this.goToPage(pageNumber),
    setCurrentPageNumber: (pageNumber: number) => this.goToPage(pageNumber),
    openElements: (elements: string[]) => this.bus.emit('action-open-elements', { elements }),
    closeElements: (elements: string[]) => this.bus.emit('action-close-elements', { elements }),
    enableElements: (elements: string[]) => this.bus.emit('action-open-elements', { elements }),
    disableElements: (elements: string[]) => this.bus.emit('action-close-elements', { elements }),
    setActiveLeftPanel: (panel: string) => this.bus.emit('action-set-active-left-panel', { panel }),
    setToolMode: (tool: string | null) => {
      let normalizedTool: any = tool;
      if (tool && (tool.toLowerCase() === 'select' || tool.toLowerCase() === 'textselect')) {
        normalizedTool = 'select';
      } else if (tool && tool.toLowerCase() === 'pan') {
        normalizedTool = 'pan';
      }
      this.bus.emit('action-set-tool', { tool: normalizedTool });
    },
    getSelectedText: () => this.getSelectedText(),
    copySelectedText: () => this.copySelectedText(),
    fitWidth: (ratio?: number) => this.bus.emit('action-fit-to-width', typeof ratio === 'number' ? { ratio } : undefined),
    fitPage: () => this.bus.emit('action-fit-to-page'),
    fitToWidth: (ratio?: number) => this.bus.emit('action-fit-to-width', typeof ratio === 'number' ? { ratio } : undefined),
    fitToPage: () => this.bus.emit('action-fit-to-page'),
    startCompare: (docA: any, docB: any, options?: any) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-start-compare', { detail: { docA, docB, options } }));
      }
    },
    stopCompare: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-stop-compare'));
      }
    },
    setCompareMode: (mode: 'overlay' | 'side-by-side' | 'semantic') => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-set-compare-mode', { detail: { mode } }));
      }
    },
    setCompareColors: (colorA: string, colorB: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('action-set-compare-colors', { detail: { colorA, colorB } }));
      }
    },
  };

  readonly Core = ((self: WebViewerInstance) => ({
    /** The real AnnotationManager (XFDF import/export, granular events, permissions). */
    get annotationManager(): AnnotationManager {
      return self.annotationManager;
    },
    /** The FormManager (form schema, values, validation). */
    get formManager(): FormManager {
      return self.formManager;
    },
    documentViewer: {
      addEventListener: (event: string, callback: (detail: unknown) => void): (() => void) =>
        self.bus.on(event, callback),
      removeEventListener: (event: string, callback: (detail: unknown) => void): void =>
        self.bus.off(event, callback),
      getCurrentPage: (): number => self.getCurrentPage(),
      getPageCount: (): number => self.getPageCount(),
      goToPage: (pageNumber: number): void => self.goToPage(pageNumber),
      setCurrentPage: (pageNumber: number): void => self.goToPage(pageNumber),
      setCurrentPageNumber: (pageNumber: number): void => self.goToPage(pageNumber),
      getDocument: () => ({
        getFileData: (options?: ExportOptions) => self.getFileData(options),
      }),
    },
  }))(this);
}
