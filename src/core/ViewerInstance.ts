/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * WebViewerInstance — the imperative handle returned by `createWebViewer()` and exposed through
 * `<TeamSyncViewer ref>`. Keeps the legacy `UI` / `Core` facade for drop-in compatibility.
 */
import type * as pdfjsLib from 'pdfjs-dist';
import { ViewerBus } from './eventBus';
import { buildPdfBytes, type ExportOptions } from './export';
import type { Annotation } from '../annotations/types';
import { AnnotationManager } from '../annotations/AnnotationManager';
import { createGeometryResolver } from '../annotations/geometry';
import type { Redaction, WatermarkOptions, ViewerEventMap, ViewerEventType, TransientHighlight } from './types';
import { searchPdfText, type SearchResult } from '../hooks/usePdfSearch';

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
  readonly bus: ViewerBus;
  /** Annotation list, history, permissions and XFDF import/export. */
  readonly annotationManager: AnnotationManager;
  /** Root element of the viewer once mounted. */
  element: HTMLElement | null = null;

  private binding: ViewerBinding | null = null;
  private unmountRoot: (() => void) | null = null;
  private destroyed = false;

  constructor(bus: ViewerBus, annotationManager: AnnotationManager = new AnnotationManager()) {
    this.bus = bus;
    this.annotationManager = annotationManager;
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
  loadDocument(url: string): Promise<{ url: string; numPages: number }> {
    const b = this.binding ?? noBinding();
    return new Promise((resolve, reject) => {
      const offLoaded = this.bus.on<ViewerEventMap['documentLoaded']>('documentLoaded', (d) => {
        if (d.url !== url) return;
        cleanup();
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
   * Search the document for text matches, returning snippets and page bounding boxes.
   */
  async searchText(query: string): Promise<SearchResult[]> {
    const pdf = this.getPdfDocument();
    if (!pdf) return [];
    const b = this.binding;
    const redactions = b ? b.getRedactions() : [];
    return searchPdfText(pdf, query, redactions);
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
   */
  async highlightSnippet(
    query: string,
    options: { pageIndex?: number; pulse?: boolean; scrollTo?: boolean; color?: string; tooltip?: string } = {}
  ): Promise<SearchResult | null> {
    const results = await this.searchText(query);
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

  /** Print the exported document (annotations, redactions and watermark baked in). */
  print(): void {
    this.bus.emit('action-print');
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
      },
      options
    );
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
    setToolMode: (tool: string | null) => this.bus.emit('action-set-tool', { tool }),
    fitWidth: () => this.bus.emit('action-fit-to-width'),
    fitPage: () => this.bus.emit('action-fit-to-page'),
    fitToWidth: () => this.bus.emit('action-fit-to-width'),
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
