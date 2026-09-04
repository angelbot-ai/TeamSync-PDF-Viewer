/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * <TeamSyncViewer> — the embeddable viewer component.
 *
 * Owns every piece of UI state the demo application shell used to own (tabs, panels, zoom, layout,
 * rotation), sizes itself to its container, scopes keyboard shortcuts and the action bus to this
 * instance (several viewers can share a page) and exposes a WebViewerInstance via `ref` / `onReady`.
 */
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
// Library styles are extracted to dist/style.css by the lib build (consumers import
// 'teamsync-pdf-viewer/style.css'); bundlers keep this import because of `sideEffects` metadata.
import '../index.css';
import Header from './Header';
import DocumentViewer, { type DocumentLoadErrorInfo } from './DocumentViewer';
import SettingsModal from './SettingsModal';
import AboutModal from './AboutModal';
import { ViewerBus } from '../core/eventBus';
import { ViewerBusContext } from '../core/busContext';
import { WebViewerInstance } from '../core/ViewerInstance';
import { AnnotationManager } from '../annotations/AnnotationManager';
import { printPdfBytes } from '../core/print';
import type { WebViewerOptions, SDKPermissions, Redaction, TransientHighlight } from '../core/types';
import type { Annotation } from '../annotations/types';

export interface TeamSyncViewerProps extends Omit<WebViewerOptions, 'path'> {
  /** URL of the PDF to display. Alias of `initialDoc`; `fileUrl` wins when both are set. */
  fileUrl?: string;
  /** Fires once, after mount, with the instance handle. */
  onReady?: (instance: WebViewerInstance) => void;
  onDocumentLoaded?: (info: { url: string; numPages: number }) => void;
  /**
   * Fires when the document could not be loaded. `retry(newUrl?)` reloads — pass a fresh URL when
   * the previous one was a presigned link that expired.
   */
  onDocumentLoadError?: (error: Error, retry: (newUrl?: string) => void, info: DocumentLoadErrorInfo) => void;
  /** Fires once per document, after the first page canvas has been painted. */
  onFirstPageRendered?: (info: { url: string; pageNumber: number }) => void;
  /** Fires (in addition to onDocumentLoadError) when the document is password protected. */
  onPasswordRequired?: (info: { url: string }) => void;
  onPageChange?: (pageNumber: number, numPages: number) => void;
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  /** Fires whenever transient highlights change. */
  onTransientHighlightsChange?: (highlights: TransientHighlight[]) => void;
  className?: string;
  style?: React.CSSProperties;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 64;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const TeamSyncViewer = React.forwardRef<WebViewerInstance, TeamSyncViewerProps>(function TeamSyncViewer(props, ref) {
  const {
    fileUrl, initialDoc, initialScale, initialPage, page, transientHighlights: propTransientHighlights,
    plugins, redactions, regexRedactions,
    enableAnnotations, enableSign = false, watermark, permissions, enableRedactions,
    canAddAnnotations, canEditAnnotations, canDeleteAnnotations, readOnly = false,
    assets, withCredentials = false, toolbar = true, sidebars = true, leftPanelOpen = true,
    className, style,
  } = props;

  // Latest props for callbacks/bindings that must not re-subscribe on every render.
  const latest = useRef(props);
  latest.current = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const bus = useMemo(() => new ViewerBus(), []);
  const annotationManager = useMemo(() => new AnnotationManager(), []);
  const instanceRef = useRef<WebViewerInstance | null>(null);
  if (!instanceRef.current) instanceRef.current = new WebViewerInstance(bus, annotationManager);
  const instance = instanceRef.current;
  useImperativeHandle(ref, () => instance, [instance]);

  // ---- document ------------------------------------------------------------------------------
  const requestedUrl = fileUrl ?? initialDoc;
  const [docUrl, setDocUrl] = useState<string | undefined>(requestedUrl);
  const [loadNonce, setLoadNonce] = useState(0);
  useEffect(() => {
    setDocUrl(requestedUrl);
  }, [requestedUrl]);
  const loadDocument = useCallback((url: string) => {
    setDocUrl(url);
    setLoadNonce((n) => n + 1);
  }, []);

  // ---- UI state (formerly the demo App shell) --------------------------------------------------
  const [activeTab, setActiveTab] = useState('View');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(sidebars && leftPanelOpen);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'Comments' | 'Search'>('Comments');
  const [scale, setScale] = useState(typeof initialScale === 'number' ? initialScale : 1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [pageTransition, setPageTransition] = useState<'continuous' | 'page-by-page'>('continuous');
  const [pageLayout, setPageLayout] = useState<'single' | 'double' | 'cover-facing'>('single');
  const [rotation, setRotation] = useState(0);
  // Empty by default: hosts opt into watermarks via the `watermark` prop.
  const [watermarkText, setWatermarkText] = useState('');

  const effectivePermissions = useMemo<SDKPermissions>(() => {
    if (readOnly) {
      return { canAddAnnotations: false, canEditAnnotations: false, canDeleteAnnotations: false, canRedact: false };
    }
    return {
      canAddAnnotations: permissions?.canAddAnnotations ?? canAddAnnotations ?? enableAnnotations !== false,
      canEditAnnotations: permissions?.canEditAnnotations ?? canEditAnnotations ?? enableAnnotations !== false,
      canDeleteAnnotations: permissions?.canDeleteAnnotations ?? canDeleteAnnotations ?? enableAnnotations !== false,
      canRedact: permissions?.canRedact ?? enableRedactions ?? true,
    };
  }, [readOnly, permissions, canAddAnnotations, canEditAnnotations, canDeleteAnnotations, enableAnnotations, enableRedactions]);
  const annotationsEnabled = !readOnly && enableAnnotations !== false;

  // Keep the manager's user / permission state in sync with props.
  const currentUserId = props.currentUser?.id;
  const currentUserName = props.currentUser?.name;
  useEffect(() => {
    annotationManager.setCurrentUserInfo(currentUserId || currentUserName ? { id: currentUserId, name: currentUserName } : undefined);
  }, [annotationManager, currentUserId, currentUserName]);
  useEffect(() => {
    annotationManager.setReadOnly(readOnly);
  }, [annotationManager, readOnly]);
  useEffect(() => {
    annotationManager.setCanEditOthers(Boolean(permissions?.canEditOthers));
  }, [annotationManager, permissions?.canEditOthers]);

  // Annotations belong to a document: drop them when a different document is requested.
  useEffect(() => {
    annotationManager.clear();
    annotationManager.setDocument(null);
  }, [annotationManager, docUrl]);

  // Relay granular manager events to the instance bus (`instance.on('annotationChanged', ...)`).
  useEffect(() => annotationManager.addEventListener('annotationChanged', (e) => bus.emit('annotationChanged', e)), [annotationManager, bus]);

  useEffect(() => {
    if (effectivePermissions.canAddAnnotations === false && activeTab === 'Annotate') setActiveTab('View');
  }, [effectivePermissions.canAddAnnotations, activeTab]);

  // ---- live state exposed to the instance ------------------------------------------------------
  const redactionsRef = useRef<Redaction[]>([]);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageRef = useRef({ current: 1, count: 0 });
  const docUrlRef = useRef(docUrl);
  docUrlRef.current = docUrl;
  const signedBytesRef = useRef<Uint8Array | null>(null);
  const initialFitAppliedRef = useRef(false);

  // Transient highlights (citations, search matches)
  const [internalTransientHighlights, setInternalTransientHighlights] = useState<TransientHighlight[]>([]);
  const transientHighlights = useMemo(() => {
    return propTransientHighlights ?? internalTransientHighlights;
  }, [propTransientHighlights, internalTransientHighlights]);
  const transientHighlightsRef = useRef(transientHighlights);
  transientHighlightsRef.current = transientHighlights;

  const setTransientHighlights = useCallback((highlights: TransientHighlight[]) => {
    setInternalTransientHighlights(highlights);
    latest.current.onTransientHighlightsChange?.(highlights);
  }, []);

  useEffect(() => {
    instance._bind(
      {
        getAnnotations: () => annotationManager.getAnnotationsList(),
        getRedactions: () => redactionsRef.current,
        getWatermark: () => latest.current.watermark,
        getPdfDocument: () => pdfDocRef.current,
        getDocumentUrl: () => docUrlRef.current,
        getFileName: () => latest.current.fileName,
        getCurrentUserName: () => latest.current.currentUser?.name,
        getCurrentPage: () => pageRef.current.current,
        getPageCount: () => pageRef.current.count,
        loadDocument,
        goToPage: (pageNum: number, options?: { smooth?: boolean }) => {
          bus.emit('action-go-to-page', { page: pageNum, smooth: options?.smooth });
        },
        getTransientHighlights: () => transientHighlightsRef.current,
        setTransientHighlights,
      },
      rootRef.current
    );
    return () => instance._unbind();
  }, [instance, annotationManager, loadDocument, bus, setTransientHighlights]);

  // onReady + autoFocus, exactly once.
  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    if (latest.current.autoFocus) rootRef.current?.focus({ preventScroll: true });
    latest.current.onReady?.(instance);
  }, [instance]);

  // ---- bus wiring (formerly window listeners) --------------------------------------------------
  useEffect(() => {
    const openPanel = (tab: 'Comments' | 'Search') => {
      setRightSidebarOpen(true);
      setSidebarTab(tab);
    };

    const offs = [
      bus.on<{ elements?: string[] }>('action-open-elements', (d) => {
        const elements = d?.elements ?? [];
        if (elements.includes('leftPanel')) setLeftSidebarOpen(true);
        if (elements.includes('notesPanel')) openPanel('Comments');
        if (elements.includes('searchPanel')) openPanel('Search');
      }),
      bus.on<{ elements?: string[] }>('action-close-elements', (d) => {
        const elements = d?.elements ?? [];
        if (elements.includes('leftPanel')) setLeftSidebarOpen(false);
        if (elements.includes('notesPanel') || elements.includes('searchPanel')) setRightSidebarOpen(false);
      }),
      bus.on<{ panel?: string }>('action-set-active-left-panel', (d) => {
        const panel = d?.panel;
        if (panel === 'notesPanel') openPanel('Comments');
        else if (panel === 'searchPanel') openPanel('Search');
        else setLeftSidebarOpen(true);
      }),
      bus.on<{ tool: string | null }>('action-tool-changed', (d) => bus.emit('toolChanged', { tool: d?.tool ?? null })),
      bus.on('action-print', async () => {
        try {
          const data = await instance.getFileData();
          await printPdfBytes(data, { title: latest.current.fileName });
        } catch (err) {
          console.error('[teamsync-pdf-viewer] print failed', err);
          bus.emit('action-print-error', { error: err });
        }
      }),
      bus.on('action-download', async () => {
        try {
          let data = signedBytesRef.current;
          if (data) signedBytesRef.current = null; // consume the freshly signed bytes
          else data = await instance.getFileData();
          if (!data) return;
          const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = latest.current.fileName || 'annotated_document.pdf';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error('[teamsync-pdf-viewer] download failed', err);
          bus.emit('action-download-error', { error: err });
        }
      }),
      bus.on<{ pageIndex: number; x: number; y: number; width: number; height: number }>(
        'action-process-digital-signature',
        async (d) => {
          try {
            const { pageIndex, x, y, width, height } = d;
            const tempAnn: Annotation = {
              id: newId(),
              type: 'digital_signature_placeholder',
              pageIndex, x, y, width, height,
              color: '#0f172a', strokeWidth: 1, opacity: 1,
              signer: latest.current.currentUser?.name ?? 'Unknown signer',
              timestamp: Date.now(),
            };
            const explicitAnnotations = [...instance.getAnnotations(), tempAnn];
            bus.emit('action-waiting-for-pin-start');
            const data = await instance.getFileData({ explicitAnnotations });
            bus.emit('action-waiting-for-pin-end');
            if (!data) return;
            signedBytesRef.current = data;
            bus.emit('action-commit-digital-signature', { tempAnn });
          } catch (err: any) {
            bus.emit('action-waiting-for-pin-error', { error: err?.message ?? String(err) });
            console.error('[teamsync-pdf-viewer] process signature failed', err);
          }
        }
      ),
      bus.on<{ highlights: TransientHighlight[] }>('action-set-transient-highlights', (d) => {
        setTransientHighlights(d?.highlights ?? []);
      }),
      bus.on('action-clear-transient-highlights', () => {
        setTransientHighlights([]);
      }),
      // No external signing plugin in the loop: commit the placeholder to the page directly.
      bus.on<{ tempAnn: Annotation }>('action-commit-digital-signature', (d) =>
        bus.emit('action-commit-digital-signature-local', d)
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [bus, instance, setTransientHighlights]);

  // ---- DocumentViewer callbacks ----------------------------------------------------------------
  const handleDocumentLoaded = useCallback(
    (doc: pdfjsLib.PDFDocumentProxy, url: string) => {
      pdfDocRef.current = doc;
      annotationManager.setDocument(doc);
      pageRef.current = { current: 1, count: doc.numPages };
      initialFitAppliedRef.current = false;
      bus.emit('documentLoaded', { url, numPages: doc.numPages });
      latest.current.onDocumentLoaded?.({ url, numPages: doc.numPages });
    },
    [bus, annotationManager]
  );

  const handleLoadError = useCallback(
    (error: Error, info: DocumentLoadErrorInfo) => {
      pdfDocRef.current = null;
      annotationManager.setDocument(null);
      bus.emit('documentLoadError', { url: info.url, error, passwordRequired: info.passwordRequired });
      if (info.passwordRequired) latest.current.onPasswordRequired?.({ url: info.url });
      latest.current.onDocumentLoadError?.(error, (newUrl) => loadDocument(newUrl ?? info.url), info);
    },
    [bus, loadDocument, annotationManager]
  );

  const handleFirstPageRendered = useCallback(
    (pageNumber: number) => {
      const url = docUrlRef.current ?? '';
      if (!initialFitAppliedRef.current) {
        initialFitAppliedRef.current = true;
        const fit = latest.current.initialScale;
        if (fit === 'fit-width') setTimeout(() => bus.emit('action-fit-to-width'), 0);
        else if (fit === 'fit-page') setTimeout(() => bus.emit('action-fit-to-page'), 0);
      }
      bus.emit('firstPageRendered', { url, pageNumber });
      latest.current.onFirstPageRendered?.({ url, pageNumber });
    },
    [bus]
  );

  const handlePageChange = useCallback(
    (pageNumber: number, numPages: number) => {
      pageRef.current = { current: pageNumber, count: numPages };
      bus.emit('pageChanged', { pageNumber, numPages });
      latest.current.onPageChange?.(pageNumber, numPages);
    },
    [bus]
  );

  const handleAnnotationsChange = useCallback(
    (anns: Annotation[]) => {
      bus.emit('annotationsChanged', { annotations: anns });
      latest.current.onAnnotationsChange?.(anns);
    },
    [bus]
  );

  const handleRedactionsChange = useCallback((reds: Redaction[]) => {
    redactionsRef.current = reds;
  }, []);

  // ---- root element handlers -------------------------------------------------------------------
  const handleRootKeyDownCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (sidebars) {
        setRightSidebarOpen(true);
        setSidebarTab('Search');
        setTimeout(() => bus.emit('action-focus-search'), 50);
      }
      return;
    }
    bus.emit('viewer-keydown', e.nativeEvent);
  };

  // Clicking anywhere inside the viewer makes it the keyboard-shortcut target.
  const handleRootMouseDownCapture = () => {
    const root = rootRef.current;
    if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  };

  const toggleFullscreen = () => {
    const target = rootRef.current ?? document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const openSidebarTab = (tab: 'Comments' | 'Search') => {
    if (!sidebars) return;
    if (rightSidebarOpen && sidebarTab === tab) {
      setRightSidebarOpen(false);
    } else {
      setRightSidebarOpen(true);
      setSidebarTab(tab);
    }
  };

  return (
    <ViewerBusContext.Provider value={bus}>
      <div
        ref={rootRef}
        className={['tspdf-root', className].filter(Boolean).join(' ')}
        style={style}
        tabIndex={-1}
        data-teamsync-pdf-viewer=""
        onKeyDownCapture={handleRootKeyDownCapture}
        onMouseDownCapture={handleRootMouseDownCapture}
      >
        {toolbar && (
          <Header
            activeTab={activeTab}
            setActiveTab={(tab) => {
              if (effectivePermissions.canAddAnnotations === false && tab === 'Annotate') return;
              setActiveTab(tab);
            }}
            leftSidebarOpen={leftSidebarOpen}
            setLeftSidebarOpen={(open) => { if (sidebars) setLeftSidebarOpen(open); }}
            rightSidebarOpen={rightSidebarOpen}
            setRightSidebarOpen={setRightSidebarOpen}
            sidebarTab={sidebarTab}
            scale={scale}
            onZoomIn={() => setScale((s) => Math.min(s + 0.25, MAX_SCALE))}
            onZoomOut={() => setScale((s) => Math.max(s - 0.25, MIN_SCALE))}
            onZoomSet={(s) => setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)))}
            onDownload={() => bus.emit('action-download')}
            onFullScreen={toggleFullscreen}
            onSaveAs={() => bus.emit('action-download')}
            onPrint={() => bus.emit('action-print')}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAbout={() => setIsAboutModalOpen(true)}
            onOpenSidebarTab={openSidebarTab}
            pageTransition={pageTransition}
            setPageTransition={setPageTransition}
            pageLayout={pageLayout}
            setPageLayout={setPageLayout}
            rotation={rotation}
            setRotation={setRotation}
            enableAnnotations={annotationsEnabled}
            enableSign={enableSign}
            plugins={plugins}
            permissions={effectivePermissions}
          />
        )}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <DocumentViewer
            leftSidebarOpen={sidebars && leftSidebarOpen}
            rightSidebarOpen={sidebars && rightSidebarOpen}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            sidebars={sidebars}
            activeTab={activeTab}
            annotationManager={annotationManager}
            initialDoc={docUrl}
            loadNonce={loadNonce}
            withCredentials={withCredentials}
            assets={assets}
            redactions={redactions}
            regexRedactions={regexRedactions}
            scale={scale}
            setScale={setScale}
            onAnnotationsChange={handleAnnotationsChange}
            onRedactionsChange={handleRedactionsChange}
            onDocumentLoaded={handleDocumentLoaded}
            onLoadError={handleLoadError}
            onFirstPageRendered={handleFirstPageRendered}
            onPageChange={handlePageChange}
            pageTransition={pageTransition}
            pageLayout={pageLayout}
            rotation={rotation}
            setRotation={setRotation}
            watermark={watermark}
            watermarkText={watermarkText}
            enableAnnotations={annotationsEnabled}
            initialPage={initialPage}
            page={page}
            transientHighlights={transientHighlights}
            permissions={effectivePermissions}
          />
        </div>
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} watermarkText={watermarkText} setWatermarkText={setWatermarkText} />
        )}
        {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
      </div>
    </ViewerBusContext.Provider>
  );
});

export default TeamSyncViewer;
