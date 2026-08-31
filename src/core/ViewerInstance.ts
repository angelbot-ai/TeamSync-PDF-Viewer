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
import type { Redaction, WatermarkOptions, ViewerEventMap, ViewerEventType } from './types';

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
      getDocument: () => ({
        getFileData: (options?: ExportOptions) => self.getFileData(options),
      }),
    },
  }))(this);
}
