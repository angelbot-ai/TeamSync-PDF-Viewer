/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import { Pen, Type, Minus, Eraser, Square, Circle as CircleIcon, Highlighter, ChevronLeft, ChevronRight, Brush, MessageSquareQuote, ArrowUpRight, ShieldCheck, Link as LinkIcon, EyeOff, Trash2 } from 'lucide-react';
import AnnotationContextMenu from './AnnotationContextMenu';
import InsertLinkModal from './InsertLinkModal';
import { matchShortcut, useShortcuts } from '../hooks/useShortcuts';
import Sidebar from './Sidebar';
import LeftSidebar from './LeftSidebar';
import { usePdfSearch, type SearchResult } from '../hooks/usePdfSearch';
import PageRenderer from './PageRenderer';
import type { Annotation } from '../annotations/types';
import { newAnnotationId } from '../annotations/ids';
import type { AnnotationManager } from '../annotations/AnnotationManager';
import type { Redaction, WatermarkOptions, SDKPermissions, PdfAssetPaths } from '../core/types';
import { findRegexRedactions } from '../utils/findRegexRedactions';
import { convertToUnrotated, convertToRotated, normalizeRotation } from '../utils/rotationUtils';
import { useViewerBus, useBusEvent } from '../hooks/useViewerBus';
import { assertWorkerConfigured, configurePdfAssets, getDocumentParams } from '../core/pdfAssets';
import CompareToolbar from './CompareToolbar';
import CompareCurtainSlider from './CompareCurtainSlider';
import SideBySideViewer from './SideBySideViewer';
import DiffSummarySidebar from './DiffSummarySidebar';
import type { CompareOptions, CompareState, TextDiffSegment } from '../types/compare';
import { computeTextDiff } from '../utils/pdfDiffEngine';

export interface DocumentLoadErrorInfo {
  url: string;
  passwordRequired: boolean;
}

interface DocumentViewerProps {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activeTab: string;
  /** Canonical annotation list, history, permissions and XFDF (owned by the viewer instance). */
  annotationManager: AnnotationManager;
  initialDoc?: string;
  /** Bump to force a reload of the same URL (retry after a load error). */
  loadNonce?: number;
  /** Send cookies with the document request. */
  withCredentials?: boolean;
  /** pdf.js asset locations, applied right before the document is opened. */
  assets?: PdfAssetPaths;
  /** Render the thumbnails (left) and comments/search (right) panels. Default true. */
  sidebars?: boolean;
  redactions?: Redaction[];
  regexRedactions?: RegExp[];
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  sidebarTab: 'Comments' | 'Search';
  setSidebarTab: (tab: 'Comments' | 'Search') => void;
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  /** Reports the combined (prop + regex + manual) redaction list whenever it changes. */
  onRedactionsChange?: (redactions: Redaction[]) => void;
  onDocumentLoaded?: (doc: pdfjsLib.PDFDocumentProxy, url: string) => void;
  onLoadError?: (error: Error, info: DocumentLoadErrorInfo) => void;
  /** Fires once per loaded document, after the first page canvas has been painted. */
  onFirstPageRendered?: (pageNumber: number) => void;
  onPageChange?: (pageNumber: number, numPages: number) => void;
  pageTransition: 'continuous' | 'page-by-page';
  pageLayout: 'single' | 'double' | 'cover-facing';
  rotation: number;
  setRotation: (r: number | ((prev: number) => number)) => void;
  watermark?: WatermarkOptions;
  watermarkText?: string;
  enableAnnotations?: boolean;
  initialPage?: number;
  permissions?: SDKPermissions;
  compareDoc?: string | ArrayBuffer | Uint8Array;
  compareOptions?: CompareOptions;
}

export default function DocumentViewer({
  leftSidebarOpen, rightSidebarOpen, activeTab, annotationManager, initialDoc, loadNonce = 0, withCredentials = false, assets, sidebars = true,
  redactions, regexRedactions, scale, setScale, sidebarTab, setSidebarTab, onAnnotationsChange, onRedactionsChange,
  onDocumentLoaded, onLoadError, onFirstPageRendered, onPageChange,
  pageTransition, pageLayout, rotation, setRotation, watermark, watermarkText, enableAnnotations: _enableAnnotations, initialPage, permissions,
  compareDoc, compareOptions
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bus = useViewerBus();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [manualRedactions, setManualRedactions] = useState<Redaction[]>([]);
  const { getCommand } = useShortcuts();

  // Latest-callback refs: parents may pass inline functions without re-triggering effects.
  const callbacksRef = useRef({ onRedactionsChange, onDocumentLoaded, onLoadError, onFirstPageRendered, onPageChange });
  callbacksRef.current = { onRedactionsChange, onDocumentLoaded, onLoadError, onFirstPageRendered, onPageChange };
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  // Provide combinedRedactions to usePdfSearch but wait, combinedRedactions is computed later in the file.
  // We can just move the combinedRedactions useMemo up before usePdfSearch, 
  // or we can pass an empty array initially and it will update.
  // Let's just move usePdfSearch below combinedRedactions.
  // Comparison State & Engine
  const [compareState, setCompareState] = useState<CompareState>({
    isActive: false,
    mode: compareOptions?.mode || 'overlay',
    colorA: compareOptions?.colorA || '#e11d48',
    colorB: compareOptions?.colorB || '#0284c7',
    opacityA: compareOptions?.opacityA || 0.75,
    opacityB: compareOptions?.opacityB || 0.75,
    blendMode: compareOptions?.blendMode || 'multiply',
    curtainPosition: 50,
    showCurtain: false,
    diffItems: [],
    currentDiffIndex: 0
  });
  const [pdfDocB, setPdfDocB] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [textDiffs, setTextDiffs] = useState<TextDiffSegment[]>([]);
  const [isDiffSidebarOpen, setIsDiffSidebarOpen] = useState(false);

  const loadDocA = useCallback(async (docSource: string | ArrayBuffer | Uint8Array) => {
    try {
      assertWorkerConfigured();
      if (assetsRef.current) configurePdfAssets(assetsRef.current);
      const params: any = typeof docSource === 'string' ? { url: docSource } : { data: docSource };
      if (withCredentials) params.withCredentials = true;
      Object.assign(params, getDocumentParams());
      const loadingTask = pdfjsLib.getDocument(params);
      const loadedDocA = await loadingTask.promise;
      setPdfDoc(loadedDocA);
    } catch (err) {
      console.error('Failed to load comparison document A:', err);
    }
  }, [withCredentials]);

  const loadCompareDoc = useCallback(async (docSource: string | ArrayBuffer | Uint8Array) => {
    try {
      assertWorkerConfigured();
      if (assetsRef.current) configurePdfAssets(assetsRef.current);
      const params: any = typeof docSource === 'string' ? { url: docSource } : { data: docSource };
      if (withCredentials) params.withCredentials = true;
      Object.assign(params, getDocumentParams());
      const loadingTask = pdfjsLib.getDocument(params);
      const loadedDocB = await loadingTask.promise;
      setPdfDocB(loadedDocB);
      setCompareState(prev => ({ ...prev, isActive: true, docB: docSource }));
      setIsDiffSidebarOpen(true);
    } catch (err) {
      console.error('Failed to load comparison document B:', err);
    }
  }, [withCredentials]);

  useEffect(() => {
    if (compareDoc) {
      loadCompareDoc(compareDoc);
    }
  }, [compareDoc, loadCompareDoc]);

  // Compute text diffs when both pdfDoc and pdfDocB are loaded
  useEffect(() => {
    if (compareState.isActive && pdfDoc && pdfDocB) {
      const computeDiffs = async () => {
        try {
          const pageA = await pdfDoc.getPage(pageNum);
          const pageB = await pdfDocB.getPage(pageNum);
          const textContentA = await pageA.getTextContent();
          const textContentB = await pageB.getTextContent();
          const strA = textContentA.items.map((i: any) => i.str).join(' ');
          const strB = textContentB.items.map((i: any) => i.str).join(' ');

          const diffs = computeTextDiff(strA, strB, pageNum);
          setTextDiffs(diffs);
        } catch (e) {
          console.error('Error computing page text diff:', e);
        }
      };
      computeDiffs();
    }
  }, [compareState.isActive, pdfDoc, pdfDocB, pageNum]);

  // Public Event Listeners for Compare APIs
  useEffect(() => {
    const handleStartCompare = async (e: any) => {
      const { docA, docB, options } = e.detail || {};
      if (options) {
        setCompareState(prev => ({
          ...prev,
          mode: options.mode || prev.mode,
          colorA: options.colorA || prev.colorA,
          colorB: options.colorB || prev.colorB,
          opacityA: options.opacityA || prev.opacityA,
          opacityB: options.opacityB || prev.opacityB,
          blendMode: options.blendMode || prev.blendMode
        }));
      }
      if (docA) {
        await loadDocA(docA);
      }
      if (docB) {
        await loadCompareDoc(docB);
      }
    };

    const handleStopCompare = () => {
      setCompareState(prev => ({ ...prev, isActive: false }));
      setPdfDocB(null);
      setTextDiffs([]);
    };

    const handleSetCompareMode = (e: any) => {
      if (e.detail?.mode) {
        setCompareState(prev => ({ ...prev, mode: e.detail.mode }));
      }
    };

    const handleSetCompareColors = (e: any) => {
      if (e.detail?.colorA && e.detail?.colorB) {
        setCompareState(prev => ({ ...prev, colorA: e.detail.colorA, colorB: e.detail.colorB }));
      }
    };

    window.addEventListener('action-start-compare', handleStartCompare);
    window.addEventListener('action-stop-compare', handleStopCompare);
    window.addEventListener('action-set-compare-mode', handleSetCompareMode);
    window.addEventListener('action-set-compare-colors', handleSetCompareColors);

    return () => {
      window.removeEventListener('action-start-compare', handleStartCompare);
      window.removeEventListener('action-stop-compare', handleStopCompare);
      window.removeEventListener('action-set-compare-mode', handleSetCompareMode);
      window.removeEventListener('action-set-compare-colors', handleSetCompareColors);
    };
  }, [loadDocA, loadCompareDoc]);

  // Per-page base dimensions (scale 1, UI rotation composed with the page's /Rotate). Index =
  // pageNumber - 1. Populated progressively after load so mixed-size documents lay out correctly.
  const [pageDims, setPageDims] = useState<Array<{ width: number; height: number }>>([]);
  const fallbackDims = pageDims[0] ?? { width: 800, height: 1100 };
  const dimsFor = useCallback(
    (p: number) => pageDims[p - 1] ?? fallbackDims,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageDims, fallbackDims.width, fallbackDims.height]
  );
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number, y: number, scrollLeft: number, scrollTop: number } | null>(null);

  const GAP = 16;

  // Rows of pages (1 or 2 per row depending on layout)
  const rows = useMemo(() => {
    const r: number[][] = [];
    if (!pdfDoc) return r;
    if (pageLayout === 'single') {
      for (let i = 1; i <= pdfDoc.numPages; i++) r.push([i]);
    } else if (pageLayout === 'double') {
      for (let i = 1; i <= pdfDoc.numPages; i += 2) {
        r.push([i, i + 1].filter(p => p <= pdfDoc.numPages));
      }
    } else if (pageLayout === 'cover-facing') {
      r.push([1]);
      for (let i = 2; i <= pdfDoc.numPages; i += 2) {
        r.push([i, i + 1].filter(p => p <= pdfDoc.numPages));
      }
    }
    return r;
  }, [pdfDoc, pageLayout]);

  // Row geometry in scaled pixels: each row is as tall as its tallest page (+ gap).
  const rowLayout = useMemo(() => {
    const heights = rows.map(row => Math.max(...row.map(p => dimsFor(p).height)) * scale + GAP);
    const tops: number[] = [];
    let acc = 0;
    for (const h of heights) { tops.push(acc); acc += h; }
    return { heights, tops, total: acc };
  }, [rows, scale, dimsFor]);

  const rowIndexOfPage = useCallback((p: number) => rows.findIndex(row => row.includes(p)), [rows]);

  const rowIndexAtOffset = useCallback((y: number) => {
    const tops = rowLayout.tops;
    if (tops.length === 0) return 0;
    let lo = 0, hi = tops.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (tops[mid] <= y) lo = mid; else hi = mid - 1;
    }
    return lo;
  }, [rowLayout]);

  const scrollToPage = useCallback((p: number) => {
    const i = rowIndexOfPage(p);
    if (i >= 0 && containerRef.current) containerRef.current.scrollTop = rowLayout.tops[i];
  }, [rowIndexOfPage, rowLayout]);

  const [activeSearchResult, setActiveSearchResult] = useState<SearchResult | null>(null);

  const handleSearchResultClick = (result: SearchResult) => {
    setPageNum(result.pageIndex);
    setActiveSearchResult(result);
    scrollToPage(result.pageIndex);
  };

  // The annotation list lives in the AnnotationManager (undo/redo, permissions, events, XFDF).
  const annotations = useSyncExternalStore(annotationManager.subscribe, annotationManager.getSnapshot, annotationManager.getSnapshot);
  const [activeTool, setActiveTool] = useState<'rectangle' | 'ellipse' | 'line' | 'arrow' | 'freehand' | 'highlight' | 'text' | 'eraser' | 'note' | 'callout' | 'signature' | 'digital_signature' | 'pan' | 'link' | 'redaction' | null>('pan');
  
  // Set default tools when switching tabs
  useEffect(() => {
    if (activeTab === 'Annotate') {
      setActiveTool('highlight');
      setCurrentColor('#fbc02d');
      setCurrentOpacity(0.5);
      setCurrentStrokeWidth(16);
    } else if (activeTab === 'Shapes') {
      setActiveTool('rectangle');
      setCurrentOpacity(1);
      setCurrentStrokeWidth(2);
    } else if (activeTab === 'Fill and Sign') {
      setActiveTool('signature');
    } else if (activeTab === 'View') {
      setActiveTool('pan');
    }
  }, [activeTab]);

  useEffect(() => {
    bus.emit('action-tool-changed', { tool: activeTool });
  }, [activeTool, bus]);
  


  // Style State
  const [currentColor, setCurrentColor] = useState('#d32f2f');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [currentOpacity, setCurrentOpacity] = useState(0.8);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeDrawingPageNum, setActiveDrawingPageNum] = useState<number | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [freehandPoints, setFreehandPoints] = useState<{ x: number, y: number }[]>([]);
  
  // Text Tool State
  const [activeTextEditor, setActiveTextEditor] = useState<{ x: number, y: number, type: 'text' | 'note' | 'callout' | 'link', annId?: string, points?: {x: number, y: number}[], pageIndex: number } | null>(null);
  const [currentText, setCurrentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const justCreatedLinkRef = useRef(false);


  useBusEvent<{ tool: typeof activeTool }>('action-set-tool', (d) => setActiveTool(d?.tool ?? null));

  const zoomFocusRef = useRef<{vx: number | null, vy: number | null}>({ vx: null, vy: null });
  const prevScaleRef = useRef(scale);

  // Unified scroll offset maintenance for any scale change (wheel or toolbar)
  useEffect(() => {
    if (prevScaleRef.current !== scale) {
      const s = prevScaleRef.current;
      const newScale = scale;
      prevScaleRef.current = scale;
      
      const container = containerRef.current;
      if (container) {
        const cW = container.clientWidth;
        const cH = container.clientHeight;
        
        let vx = cW / 2;
        let vy = cH / 2;
        if (zoomFocusRef.current.vx !== null && zoomFocusRef.current.vy !== null) {
          vx = zoomFocusRef.current.vx;
          vy = zoomFocusRef.current.vy;
          zoomFocusRef.current = { vx: null, vy: null };
        }
        
        const x = vx + container.scrollLeft;
        const y = vy + container.scrollTop;
        
        const baseW = dimsFor(pageNum).width;
        const pLeft1 = Math.max(0, cW / 2 - (baseW * s) / 2);
        const pLeft2 = Math.max(0, cW / 2 - (baseW * newScale) / 2);
        
        const pageX = x - pLeft1;
        const newPageX = pageX * (newScale / s);
        const newX = pLeft2 + newPageX;
        
        container.scrollLeft = newX - vx;
        container.scrollTop = (y * (newScale / s)) - vy;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        
        const multiplier = Math.exp(-e.deltaY * 0.002);
        
        setScale(s => {
          const newScale = Math.min(Math.max(s * multiplier, 0.5), 64);
          if (newScale !== s) {
            zoomFocusRef.current = { 
              vx: clientX - rect.left, 
              vy: clientY - rect.top 
            };
          }
          return newScale;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [setScale]);

  // Commit a new list to the manager (diffed into add/modify/delete, permission-checked, undoable).
  const commitAnnotations = useCallback((newAnns: Annotation[]) => {
    annotationManager.commit(newAnns);
  }, [annotationManager]);

  useBusEvent<{ tempAnn: Annotation }>('action-commit-digital-signature-local', (d) => {
    if (d?.tempAnn) commitAnnotations([...annotations, d.tempAnn]);
  });

  const handleUndo = useCallback(() => { annotationManager.undo(); }, [annotationManager]);
  const handleRedo = useCallback(() => { annotationManager.redo(); }, [annotationManager]);

  // Keyboard shortcuts are delivered by <TeamSyncViewer> from its root element, so they only apply
  // to the viewer instance that currently has focus (several viewers can share a page).
  useBusEvent<KeyboardEvent>('viewer-keydown', (e) => {
    const isInput = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';

    if (matchShortcut(e, getCommand('ROTATE_CW'))) {
      e.preventDefault();
      setRotation(r => (r + 90) % 360);
      return;
    }
    if (matchShortcut(e, getCommand('ROTATE_CCW'))) {
      e.preventDefault();
      setRotation(r => (r - 90) % 360);
      return;
    }
    if (matchShortcut(e, getCommand('UNDO'))) {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (matchShortcut(e, getCommand('REDO'))) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Don't delete if we are actively typing in a textarea
    if (!isInput && !activeTextEditor) {
      if (matchShortcut(e, getCommand('DELETE')) && selectedAnnotationId) {
        e.preventDefault();
        commitAnnotations(annotations.filter(a => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
    }
  });

  useEffect(() => {
    if (activeTextEditor && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 10);
    }
  }, [activeTextEditor]);

  useEffect(() => {
    if (onAnnotationsChange) {
      onAnnotationsChange(annotations);
    }
  }, [annotations, onAnnotationsChange]);

  // --- Dynamic Regex Redactions ---
  const [autoRedactions, setAutoRedactions] = useState<Redaction[]>([]);
  
  useEffect(() => {
    if (pdfDoc && regexRedactions && regexRedactions.length > 0) {
      let cancelled = false;
      findRegexRedactions(pdfDoc, regexRedactions).then(results => {
        if (!cancelled) setAutoRedactions(results);
      });
      return () => { cancelled = true; };
    } else {
      setAutoRedactions([]);
    }
  }, [pdfDoc, regexRedactions]);

  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  const combinedRedactions = useMemo(() => {
    return [...(redactions || []), ...autoRedactions, ...manualRedactions];
  }, [redactions, autoRedactions, manualRedactions]);

  // Share the live redaction list with the instance (export needs it) instead of window globals.
  useEffect(() => {
    callbacksRef.current.onRedactionsChange?.(combinedRedactions);
  }, [combinedRedactions]);

  const pendingRedactionsCount = useMemo(() => {
    return combinedRedactions.filter(r => r.status === 'pending').length;
  }, [combinedRedactions]);

  const handleDiscardAllRedactions = useCallback(() => {
    setManualRedactions(prev => prev.filter(r => r.status === 'applied'));
    setAutoRedactions(prev => prev.filter(r => r.status === 'applied'));
  }, []);

  const handleDiscardRedaction = useCallback((red: Redaction) => {
    setManualRedactions(prev => prev.filter(r => r !== red && r.id !== red.id));
    setAutoRedactions(prev => prev.filter(r => r !== red && r.id !== red.id));
  }, []);

  const { search, searchResults, isSearching, searchProgress } = usePdfSearch(pdfDoc, combinedRedactions);

  // Load the document. Re-runs when the URL or the reload nonce changes; the previous loading task
  // (and its worker transport) is destroyed on cleanup so documents never leak across loads.
  const firstPageRenderedRef = useRef(false);
  useEffect(() => {
    setPdfDoc(null);
    setLoadError(null);
    setPageNum(1);
    setPageDims([]);
    firstPageRenderedRef.current = false;
    if (!initialDoc) return;

    const url = initialDoc;
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadPdf = async () => {
      try {
        if (assetsRef.current) configurePdfAssets(assetsRef.current);
        assertWorkerConfigured();
        loadingTask = pdfjsLib.getDocument({ url, withCredentials, ...getDocumentParams() });
        const doc = await loadingTask.promise;
        // If the effect was cleaned up meanwhile, the loading task (and its worker transport)
        // has already been destroyed by the cleanup function.
        if (cancelled) return;
        setPdfDoc(doc);
        callbacksRef.current.onDocumentLoaded?.(doc, url);
      } catch (error: any) {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(String(error?.message ?? error));
        const passwordRequired = error?.name === 'PasswordException';
        console.error('[teamsync-pdf-viewer] Error loading PDF:', err.message, err);
        setLoadError(err);
        callbacksRef.current.onLoadError?.(err, { url, passwordRequired });
      }
    };
    loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [initialDoc, loadNonce, withCredentials]);

  const handlePageRendered = useCallback((renderedPage: number) => {
    if (firstPageRenderedRef.current) return;
    firstPageRenderedRef.current = true;
    callbacksRef.current.onFirstPageRendered?.(renderedPage);
  }, []);

  useEffect(() => {
    if (pdfDoc) callbacksRef.current.onPageChange?.(pageNum, pdfDoc.numPages);
  }, [pageNum, pdfDoc]);

  // Scroll to the initial page once per document, as soon as its row geometry is known.
  const initialScrollDoneRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  useEffect(() => {
    if (!pdfDoc || !initialPage || initialPage <= 1) return;
    if (initialScrollDoneRef.current === pdfDoc) return;
    if (pageDims.length < Math.min(initialPage, pdfDoc.numPages)) return;
    initialScrollDoneRef.current = pdfDoc;
    const t = setTimeout(() => scrollToPage(initialPage), 50);
    return () => clearTimeout(t);
  }, [pdfDoc, initialPage, pageDims.length, scrollToPage]);

  // Compute every page's base dimensions when the document or the UI rotation changes. The first
  // page is published immediately so layout can start; the rest stream in.
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const doc = pdfDoc;
    (async () => {
      const dims: Array<{ width: number; height: number }> = [];
      for (let p = 1; p <= doc.numPages; p++) {
        let page: pdfjsLib.PDFPageProxy;
        try { page = await doc.getPage(p); } catch { return; }
        if (cancelled) return;
        // UI rotation composes on top of the page's intrinsic /Rotate (pdf.js replaces it when an
        // explicit `rotation` is passed). Dimensions swap for 90/270 so layout stays correct.
        const vp = page.getViewport({ scale: 1, rotation: normalizeRotation(page.rotate + rotation) });
        dims.push({ width: vp.width, height: vp.height });
        if (p === 1 || p % 50 === 0) setPageDims([...dims]);
      }
      if (!cancelled) setPageDims(dims);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, rotation]);

  // Dynamic Fit to Width calculation
  const handleFitToWidth = useCallback(() => {
    const dims = dimsFor(pageNum);
    if (!containerRef.current || !dims.width) return;
    const availableWidth = containerRef.current.clientWidth - 48;
    if (availableWidth > 0 && dims.width > 0) {
      const newScale = availableWidth / dims.width;
      const clampedScale = Math.max(0.1, Math.min(32, parseFloat(newScale.toFixed(2))));
      setScale(clampedScale);
    }
  }, [dimsFor, pageNum, setScale]);

  // Dynamic Fit to Page calculation
  const handleFitToPage = useCallback(() => {
    const dims = dimsFor(pageNum);
    if (!containerRef.current || !dims.width || !dims.height) return;
    const availableWidth = containerRef.current.clientWidth - 48;
    const availableHeight = containerRef.current.clientHeight - 48;
    if (availableWidth > 0 && availableHeight > 0 && dims.width > 0 && dims.height > 0) {
      const scaleX = availableWidth / dims.width;
      const scaleY = availableHeight / dims.height;
      const newScale = Math.min(scaleX, scaleY);
      const clampedScale = Math.max(0.1, Math.min(32, parseFloat(newScale.toFixed(2))));
      setScale(clampedScale);
    }
  }, [dimsFor, pageNum, setScale]);

  useBusEvent('action-fit-to-width', () => handleFitToWidth());
  useBusEvent('action-fit-to-page', () => handleFitToPage());

  const getUnrotatedPoint = (e: React.MouseEvent<Element>, pageNumber: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / scale;
    const rawY = (e.clientY - rect.top) / scale;
    const dims = dimsFor(pageNumber);
    const unW = rotation % 180 === 0 ? dims.width : dims.height;
    const unH = rotation % 180 === 0 ? dims.height : dims.width;
    return convertToUnrotated(rawX, rawY, rotation, unW, unH);
  };

  const handleMouseDown = (e: React.MouseEvent<Element>, targetPageNum: number) => {
    if (!activeTool) return;
    
    const { x, y } = getUnrotatedPoint(e, targetPageNum);

    if (activeTool === 'text' || activeTool === 'note') {
      e.preventDefault();
      return;
    }

    if (activeTool === 'eraser') {
      setIsDrawing(true);
      return;
    }

    setStartPos({ x, y });
    setCurrentPos({ x, y });
    if (activeTool === 'freehand') {
      setIsDrawing(true);
      setFreehandPoints([{ x, y }]);
      setActiveDrawingPageNum(targetPageNum);
    } else if (['rectangle', 'ellipse', 'line', 'arrow', 'highlight', 'redaction'].includes(activeTool)) {
      setIsDrawing(true);
      setActiveDrawingPageNum(targetPageNum);
    } else if (['callout', 'link'].includes(activeTool)) {
      setIsDrawing(true);
      setActiveDrawingPageNum(targetPageNum);
    }
  };

  const commitTextAnnotation = () => {
    if (activeTextEditor && currentText.trim()) {
      if (activeTextEditor.annId) {
        commitAnnotations(annotations.map(a => 
          a.id === activeTextEditor.annId ? { ...a, text: currentText } : a
        ));
      } else {
        const annId = newAnnotationId();
        commitAnnotations([...annotations, {
          id: annId,
          type: activeTextEditor.type,
          pageIndex: activeTextEditor.pageIndex,
          x: activeTextEditor.x,
          y: activeTextEditor.y,
          width: Math.max(100, currentText.length * 8 + 20),
          height: 30,
          text: currentText,
          points: activeTextEditor.points,
          color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
        }]);
      }
    }
    setActiveTextEditor(null);
    setCurrentText('');
    if (activeTool === 'text') {
      setActiveTool(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<Element>, targetPageNum: number) => {
    if (!isDrawing) return;
    const { x, y } = getUnrotatedPoint(e, targetPageNum);
    setCurrentPos({ x, y });
    if (activeTool === 'freehand') {
      setFreehandPoints(prev => [...prev, { x, y }]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<Element>, targetPageNum: number) => {
    if (activeTool === 'text' || activeTool === 'note' || activeTool === 'digital_signature' || activeTool === 'link') {
      const { x, y } = getUnrotatedPoint(e, targetPageNum);
      
      if (activeTool === 'link') {
        let width = Math.abs(currentPos.x - startPos.x);
        let height = Math.abs(currentPos.y - startPos.y);
        let linkX = Math.min(startPos.x, currentPos.x);
        let linkY = Math.min(startPos.y, currentPos.y);

        if (width < 5 || height < 5) {
          linkX = x;
          linkY = y;
          width = 120;
          height = 35;
        }

        const annId = newAnnotationId();
        commitAnnotations([...annotations, { 
          id: annId, type: 'link', pageIndex: targetPageNum, x: linkX, y: linkY, width, height, points: [],
          color: 'transparent', strokeWidth: 0, opacity: 1, text: ''
        }]);
        setIsDrawing(false);
        setActiveDrawingPageNum(null);
        justCreatedLinkRef.current = true;
        setSelectedAnnotationId(annId);
        setIsLinkModalOpen(true);
        setActiveTool(null);
        return;
      } else if (activeTool === 'text' || activeTool === 'note') {
        if (activeTextEditor) {
          commitTextAnnotation();
        }
        setActiveTextEditor({ x, y, type: activeTool as any, pageIndex: targetPageNum });
        setCurrentText('');
      }
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    setActiveDrawingPageNum(null);
    if (!activeTool) return;
    
    if (activeTool === 'freehand') {
      if (freehandPoints.length > 2) {
        // Calculate bounding box for freehand to store x, y, width, height (simplified)
        const xs = freehandPoints.map(p => p.x);
        const ys = freehandPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        commitAnnotations([...annotations, { 
          id: newAnnotationId(), type: activeTool as any, pageIndex: targetPageNum,
          x: minX, y: minY, width: maxX - minX, height: maxY - minY,
          points: [...freehandPoints],
          strokes: [[...freehandPoints]],
          color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
        }]);
      }
      setFreehandPoints([]);
    } else {
      let width = Math.abs(currentPos.x - startPos.x);
      let height = Math.abs(currentPos.y - startPos.y);
      if (width > 5 || height > 5) {
        let x = Math.min(startPos.x, currentPos.x);
        let y = Math.min(startPos.y, currentPos.y);
        const points = (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'callout') ? [startPos, currentPos] : undefined;
        
        if ((activeTool === 'highlight' || activeTool === 'redaction') && height < 18) {
          height = Math.max(18, height);
          y = startPos.y - 9; // Center the highlight or redaction on the mouse path
        }
        
        if (activeTool === 'callout') {
          if (permissions?.canAddAnnotations === false) return;
          setActiveTextEditor({ x: currentPos.x, y: currentPos.y, type: 'callout', points, pageIndex: targetPageNum });
          setCurrentText('');
          return;
        }

        if (activeTool === 'redaction') {
          if (permissions?.canRedact === false) return;
          setManualRedactions(prev => [...prev, {
            id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            pageIndex: targetPageNum,
            x,
            y,
            width,
            height,
            status: 'pending'
          }]);
          return;
        }

        if (permissions?.canAddAnnotations === false) return;

        commitAnnotations([...annotations, { 
          id: newAnnotationId(), type: activeTool as any, pageIndex: targetPageNum, x, y, width, height, points,
          color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
        }]);
      }
    }
  };

  const handleEraserMove = (id: string) => {
    if (activeTool === 'eraser' && isDrawing) {
      commitAnnotations(annotations.filter(a => a.id !== id));
    }
  };

  const handleEraserClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      if (permissions?.canDeleteAnnotations === false) return;
      commitAnnotations(annotations.filter(a => a.id !== id));
      if (selectedAnnotationId === id) {
        setSelectedAnnotationId(null);
        setContextMenuPos(null);
      }
    } else if (activeTool === null || activeTool === 'pan') {
      const ann = annotations.find(a => a.id === id);
      if (ann && ann.linkUrl && activeTab === 'View') {
        if (ann.linkUrl.startsWith('#page=')) {
          const targetPage = parseInt(ann.linkUrl.split('=')[1]);
          scrollToPage(targetPage);
        } else {
          let linkHref = ann.linkUrl;
          if (!/^https?:\/\//i.test(linkHref)) {
            linkHref = 'https://' + linkHref;
          }
          const win = window.open(linkHref, '_blank', 'noopener,noreferrer');
          if (win) win.opener = null;
        }
        return;
      } else if (ann && (ann.type === 'note' || ann.type === 'callout' || ann.type === 'text')) {
        if (permissions?.canEditAnnotations === false || !annotationManager.canEdit(ann)) {
          setSelectedAnnotationId(id);
          return;
        }
        // Open edit mode for text-based annotations
        setActiveTextEditor({ x: ann.x, y: ann.y, type: ann.type as any, annId: ann.id, points: ann.points, pageIndex: ann.pageIndex });
        setCurrentText(ann.text || '');
        if (ann.color) setCurrentColor(ann.color);
      } else if (ann && ann.type === 'link') {
        if (permissions?.canEditAnnotations === false || !annotationManager.canEdit(ann)) {
          setSelectedAnnotationId(id);
          return;
        }
        setIsLinkModalOpen(true);
      }
      setSelectedAnnotationId(id);
      
      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      if (containerRect && container) {
        setContextMenuPos({
          top: e.clientY - containerRect.top + container.scrollTop,
          left: e.clientX - containerRect.left + container.scrollLeft
        });
      }
    }
  };

  const visibleRowRef = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPos({
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft
    });
    visibleRowRef.current = rowIndexAtOffset(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (pdfDoc && containerRef.current && pageTransition === 'continuous') {
      const midPoint = scrollPos.top + containerRef.current.clientHeight / 2;
      const cRowIndex = Math.max(0, Math.min(rows.length - 1, rowIndexAtOffset(midPoint)));
      const currentPage = rows[cRowIndex] ? rows[cRowIndex][0] : 1;
      if (currentPage !== pageNum) {
        setPageNum(currentPage);
      }
    }
  }, [scrollPos.top, scale, pdfDoc, pageNum, rowIndexAtOffset, pageTransition, rows]);

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      {sidebars && (
        <LeftSidebar
          isOpen={leftSidebarOpen}
          pdfDoc={pdfDoc}
          pageNum={pageNum}
          setPageNum={setPageNum}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      {/* Compare Sub-toolbar */}
      {compareState.isActive && (
        <CompareToolbar
          compareState={compareState}
          onSetMode={(mode) => setCompareState(prev => ({ ...prev, mode }))}
          onSetColors={(colorA, colorB) => setCompareState(prev => ({ ...prev, colorA, colorB }))}
          onToggleCurtain={() => setCompareState(prev => ({ ...prev, showCurtain: !prev.showCurtain }))}
          onPrevDiff={() => {
            if (compareState.diffItems.length === 0) return;
            const newIdx = (compareState.currentDiffIndex - 1 + compareState.diffItems.length) % compareState.diffItems.length;
            setCompareState(prev => ({ ...prev, currentDiffIndex: newIdx }));
            const item = compareState.diffItems[newIdx];
            if (item && item.pageIndex) setPageNum(item.pageIndex);
          }}
          onNextDiff={() => {
            if (compareState.diffItems.length === 0) return;
            const newIdx = (compareState.currentDiffIndex + 1) % compareState.diffItems.length;
            setCompareState(prev => ({ ...prev, currentDiffIndex: newIdx }));
            const item = compareState.diffItems[newIdx];
            if (item && item.pageIndex) setPageNum(item.pageIndex);
          }}
          onExit={() => {
            setCompareState(prev => ({ ...prev, isActive: false }));
            setPdfDocB(null);
            setTextDiffs([]);
          }}
        />
      )}
      {/* Sub-toolbar */}
      {activeTab === 'Annotate' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#fff', borderBottom: '1px solid var(--border-color)', height: '40px' }}>
          <ToolButton icon={<Highlighter size={16} />} active={activeTool === 'highlight'} onClick={() => { setActiveTool('highlight'); setCurrentColor('#fbc02d'); setCurrentOpacity(0.5); setCurrentStrokeWidth(16); }} label="Text Highlight" />
          <ToolButton icon={<Brush size={16} />} active={activeTool === 'freehand'} onClick={() => { setActiveTool('freehand'); setCurrentColor('#000000'); setCurrentOpacity(1); setCurrentStrokeWidth(2); }} label="Marker" />
          <ToolButton icon={<Type size={16} />} active={activeTool === 'text'} onClick={() => { setActiveTool('text'); setCurrentColor('#000000'); setCurrentOpacity(1); }} label="Text" />
          {permissions?.canRedact !== false && (
            <ToolButton icon={<EyeOff size={16} />} active={activeTool === 'redaction'} onClick={() => { setActiveTool('redaction'); setCurrentColor('#000000'); setCurrentOpacity(1); }} label="Redact" />
          )}
          
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />
          

          <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '8px' }}>
            <ToolButton icon={<MessageSquareQuote size={16} />} active={activeTool === 'callout'} onClick={() => { setActiveTool('callout'); setCurrentOpacity(1); setCurrentStrokeWidth(2); }} label="Callout" />
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ToolButton icon={<Pen size={16} />} active={activeTool === 'freehand' && currentOpacity === 1} onClick={() => { setActiveTool('freehand'); setCurrentOpacity(1); setCurrentStrokeWidth(2); }} label="Freehand" />
            {permissions?.canDeleteAnnotations !== false && (
              <ToolButton icon={<Eraser size={16} />} active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} label="Eraser" />
            )}
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />

          <div style={{ display: 'flex', gap: '4px' }}>
            <ToolButton icon={<Minus size={16} />} active={activeTool === 'line'} onClick={() => setActiveTool('line')} label="Line" />
            <ToolButton icon={<ArrowUpRight size={16} />} active={activeTool === 'arrow'} onClick={() => setActiveTool('arrow')} label="Arrow" />
            <ToolButton icon={<Square size={16} />} active={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} label="Rectangle" />
            <ToolButton icon={<CircleIcon size={16} />} active={activeTool === 'ellipse'} onClick={() => setActiveTool('ellipse')} label="Ellipse" />
            <ToolButton icon={<LinkIcon size={16} />} active={activeTool === 'link'} onClick={() => setActiveTool('link')} label="Link" />
          </div>
          
          <div style={{ flex: 1 }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {['line', 'arrow', 'rectangle', 'ellipse', 'freehand', 'highlight'].includes(activeTool || '') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
                <span style={{ fontSize: '12px', color: '#666', minWidth: '85px' }}>Thickness: <strong>{currentStrokeWidth}px</strong></span>
                <input 
                  type="range" 
                  min="1" 
                  max="24" 
                  value={Math.min(24, Math.max(1, currentStrokeWidth))} 
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCurrentStrokeWidth(val);
                    if (selectedAnnotationId && !activeTextEditor) {
                      commitAnnotations(annotations.map(a => a.id === selectedAnnotationId ? { ...a, strokeWidth: val } : a));
                    }
                  }}
                  style={{ width: '90px', cursor: 'pointer' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['#d32f2f', '#f57c00', '#fbc02d', '#388e3c', '#1976d2', '#7b1fa2', '#000000'].map(color => (
                <button
                  key={color}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCurrentColor(color);
                    // If an annotation is selected but not actively being edited, update its color instantly
                    if (selectedAnnotationId && !activeTextEditor) {
                      commitAnnotations(annotations.map(a => a.id === selectedAnnotationId ? { ...a, color } : a));
                    }
                  }}
                  style={{
                    width: '18px', height: '18px', borderRadius: '50%', backgroundColor: color,
                    border: currentColor === color ? '2px solid #000' : '1px solid transparent',
                    cursor: 'pointer', outline: 'none', padding: 0
                  }}
                />
              ))}
            </div>
            {pendingRedactionsCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                <button
                  onClick={() => setIsCommitModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                  }}
                  title="Apply all marked redactions permanently"
                >
                  <ShieldCheck size={16} />
                  Apply Redactions ({pendingRedactionsCount})
                </button>

                <button
                  onClick={handleDiscardAllRedactions}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ffffff',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Discard all pending unapplied redactions"
                >
                  <Trash2 size={14} color="#dc2626" />
                  Discard Redactions
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commit Redactions Confirmation Modal */}
      {isCommitModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            width: '460px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>Apply Redactions?</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Permanent content removal</p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', marginBottom: '20px' }}>
              You are about to permanently apply <strong>{pendingRedactionsCount} redaction(s)</strong>. Marked areas will be blacked out and underlying text will be permanently removed. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setIsCommitModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDiscardAllRedactions();
                  setIsCommitModalOpen(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #fca5a5',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Discard Redactions
              </button>
              <button
                onClick={() => {
                  setManualRedactions(prev => prev.map(r => ({ ...r, status: 'applied' })));
                  setAutoRedactions(prev => prev.map(r => ({ ...r, status: 'applied' })));
                  setIsCommitModalOpen(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Apply Redactions
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Main Canvas / Compare Viewport Area */}
      {compareState.isActive && compareState.mode === 'side-by-side' ? (
        <SideBySideViewer
          pdfDocA={pdfDoc}
          pdfDocB={pdfDocB}
          pageNum={pageNum}
          scale={scale}
          rotation={rotation}
          basePageDims={dimsFor(pageNum)}
          activeTab={activeTab}
          activeTool={activeTool}
          annotations={annotations}
          permissions={permissions}
          watermark={watermark}
          watermarkText={watermarkText}
          redactions={combinedRedactions}
        />
      ) : (
        <>
          {activeTool === 'highlight' && (
            <style>{`
              .pdf-viewer-area, .pdf-viewer-area * {
                cursor: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTkgMTFsLTYgNnYzaDlsMy0zIi8+PHBhdGggZD0iTTIyIDEybC00LjYgNC42YTIgMiAwIDAgMS0yLjggMGwtNS4yLTUuMmEyIDIgMCAwIDEgMC0yLjhMMTQgNCIvPjwvc3ZnPg==') 0 24, auto !important;
              }
            `}</style>
          )}
          <div 
            className="pdf-viewer-area"
          style={{ 
            flex: 1, 
            overflow: 'hidden', 
            position: 'relative', 
            backgroundColor: 'var(--bg-color)', 
            cursor: isPanning ? 'grabbing' : (activeTool === 'pan' || activeTool === null ? 'grab' : (activeTool === 'eraser' ? 'cell' : 'crosshair')) 
          }}
          onMouseMove={(e) => {
            if (isPanning && panStartRef.current && containerRef.current) {
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
              containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
            }
          }}
          onMouseLeave={() => {
            if (isPanning) {
              setIsPanning(false);
              panStartRef.current = null;
            }
          }}
        >
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            onMouseDown={(e) => {
              if (activeTool === 'pan' || activeTool === null) {
                if (e.button === 0) {
                  setIsPanning(true);
                  panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    scrollLeft: e.currentTarget.scrollLeft,
                    scrollTop: e.currentTarget.scrollTop
                  };
                }
              }
            }}
            onMouseUp={(_e) => {
              if (isPanning) {
                setIsPanning(false);
                panStartRef.current = null;
              }
            }}
            onContextMenu={(e) => {
              // Prevent default browser context menu
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{ 
              width: '100%', 
              height: '100%', 
              overflow: 'auto',
              position: 'relative'
            }}
          >
            {(() => {
              const renderRow = (row: number[], rIndex: number, isContinuous: boolean) => {
                const rTop = isContinuous ? (rowLayout.tops[rIndex] ?? 0) : 0;
                
                // Virtualization filtering (only for continuous)
                if (isContinuous && containerRef.current) {
                  // Render 5 rows before and 8 rows after the currently visible row.
                  // By relying on visibleRowRef, we decouple virtualization from the 
                  // transient async lag of scrollPos during rapid scale changes.
                  if (rIndex < visibleRowRef.current - 5 || rIndex > visibleRowRef.current + 8) {
                    return null;
                  }
                }

                // Synthesize live drawing annotation if applicable
                const liveAnn = (isDrawing && activeDrawingPageNum && activeTool && activeTool !== 'eraser') ? (() => {
                  if (activeTool === 'freehand') {
                    return {
                      id: 'temp-live-drawing', type: 'freehand' as const, pageIndex: activeDrawingPageNum,
                      x: 0, y: 0, width: 0, height: 0, points: freehandPoints,
                      color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
                    };
                  } else if (activeTool === 'highlight') {
                    let width = Math.abs(currentPos.x - startPos.x);
                    let height = Math.abs(currentPos.y - startPos.y);
                    let x = Math.min(startPos.x, currentPos.x);
                    let y = Math.min(startPos.y, currentPos.y);
                    if (height < 18) {
                      height = Math.max(18, height);
                      y = startPos.y - 9;
                    }
                    return {
                      id: 'temp-live-drawing', type: 'highlight' as const, pageIndex: activeDrawingPageNum,
                      x, y, width, height,
                      color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
                    };
                  } else if (activeTool === 'redaction') {
                    let width = Math.abs(currentPos.x - startPos.x);
                    let height = Math.abs(currentPos.y - startPos.y);
                    let x = Math.min(startPos.x, currentPos.x);
                    let y = Math.min(startPos.y, currentPos.y);
                    if (height < 18) {
                      height = Math.max(18, height);
                      y = startPos.y - 9;
                    }
                    return {
                      id: 'temp-live-drawing', type: 'rectangle' as const, pageIndex: activeDrawingPageNum,
                      x, y, width, height,
                      color: '#000000', strokeWidth: 1, opacity: 0.7
                    };
                  } else if (['line', 'arrow', 'callout', 'rectangle', 'ellipse', 'link'].includes(activeTool as string)) {
                    const width = Math.abs(currentPos.x - startPos.x);
                    const height = Math.abs(currentPos.y - startPos.y);
                    const x = Math.min(startPos.x, currentPos.x);
                    const y = Math.min(startPos.y, currentPos.y);
                    const points = (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'callout') ? [startPos, currentPos] : undefined;
                    return {
                      id: 'temp-live-drawing', type: activeTool as any, pageIndex: activeDrawingPageNum,
                      x, y, width, height, points,
                      color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity
                    };
                  }
                })() : null;

                return row.map((p, pIdx) => {
                  let pLeft: number | undefined = undefined;
                  const cW = containerRef.current?.clientWidth || 0;
                  const pageDim = dimsFor(p);
                  const firstWidth = dimsFor(row[0]).width * scale;
                  const thisWidth = pageDim.width * scale;
                  if (row.length === 2) {
                    if (pIdx === 0) pLeft = Math.max(0, cW / 2 - firstWidth);
                    if (pIdx === 1) pLeft = Math.max(firstWidth, cW / 2);
                  } else {
                    pLeft = Math.max(0, cW / 2 - thisWidth / 2);
                  }
                  
                  const pageAnnotations = (liveAnn && liveAnn.pageIndex === p) ? [...annotations, liveAnn] : annotations;

                  return (
                    <React.Fragment key={p}>
                      <PageRenderer 
                        pageNum={p}
                        pdfDoc={pdfDoc!}
                        scale={scale}
                        rotation={rotation}
                        containerWidth={containerRef.current?.clientWidth || 0}
                        containerHeight={containerRef.current?.clientHeight || 0}
                        scrollTop={scrollPos.top}
                        scrollLeft={scrollPos.left}
                        pageTop={rTop}
                        pageLeft={pLeft}
                        basePageWidth={pageDim.width}
                        basePageHeight={pageDim.height}
                        activeTab={activeTab}
                        activeTool={activeTool}
                        annotations={pageAnnotations}
                        selectedAnnotationId={selectedAnnotationId}
                        activeSearchResult={activeSearchResult}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onAnnotationClick={handleEraserClick}
                        onAnnotationMouseEnter={handleEraserMove}
                        onClearSelection={() => {
                          if (justCreatedLinkRef.current || isLinkModalOpen) {
                            justCreatedLinkRef.current = false;
                            return;
                          }
                          setSelectedAnnotationId(null);
                          setContextMenuPos(null);
                        }}
                        watermark={watermark}
                        watermarkText={watermarkText}
                        redactions={combinedRedactions}
                        onDiscardRedaction={handleDiscardRedaction}
                        onRendered={handlePageRendered}
                      />
                      {compareState.isActive && compareState.mode === 'overlay' && pdfDocB && (
                        <div style={{
                          position: 'absolute',
                          top: `${rTop}px`,
                          left: pLeft !== undefined ? `${pLeft}px` : '0px',
                          width: `${pageDim.width * scale}px`,
                          height: `${pageDim.height * scale}px`,
                          pointerEvents: 'none',
                          mixBlendMode: compareState.blendMode as any,
                          opacity: compareState.opacityB,
                          zIndex: 12,
                          filter: 'contrast(1.2) brightness(0.95)'
                        }}>
                          <PageRenderer 
                            pageNum={p}
                            pdfDoc={pdfDocB}
                            scale={scale}
                            rotation={rotation}
                            containerWidth={containerRef.current?.clientWidth || 0}
                            containerHeight={containerRef.current?.clientHeight || 0}
                            scrollTop={scrollPos.top}
                            scrollLeft={scrollPos.left}
                            pageTop={0}
                            pageLeft={0}
                            basePageWidth={pageDim.width}
                            basePageHeight={pageDim.height}
                            activeTab={activeTab}
                            activeTool={null}
                            annotations={[]}
                            selectedAnnotationId={null}
                            activeSearchResult={null}
                            onMouseDown={() => {}}
                            onMouseMove={() => {}}
                            onMouseUp={() => {}}
                            onAnnotationClick={() => {}}
                            onAnnotationMouseEnter={() => {}}
                            onClearSelection={() => {}}
                          />
                        </div>
                      )}
                      {activeTextEditor && activeTextEditor.pageIndex === p && (() => {
                        const unW = rotation % 180 === 0 ? pageDim.width : pageDim.height;
                        const unH = rotation % 180 === 0 ? pageDim.height : pageDim.width;
                        const rotEditorPos = convertToRotated(activeTextEditor.x, activeTextEditor.y, rotation, unW, unH);
                        return (
                          <div style={{
                            position: 'absolute',
                            left: `${(pLeft || 0) + rotEditorPos.x * scale}px`,
                            top: `${rTop + rotEditorPos.y * scale}px`,
                            zIndex: 50,
                            backgroundColor: '#fff',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column'
                          }}>
                          <textarea
                            ref={textareaRef}
                            value={currentText}
                            onChange={e => setCurrentText(e.target.value)}
                            onBlur={(e) => {
                              // Only commit on blur if we are not clicking inside the editor container
                              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                                commitTextAnnotation();
                              }
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextAnnotation(); } }}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: currentColor,
                              fontSize: '16px',
                              fontFamily: 'sans-serif',
                              minWidth: '150px',
                              minHeight: '40px',
                              outline: 'none',
                              resize: 'both',
                              padding: '8px'
                            }}
                            placeholder={activeTextEditor.type === 'note' ? "Note text..." : "Type text..."}
                            autoFocus
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', borderTop: '1px solid #eee' }}>
                            <button 
                              onMouseDown={(e) => { e.preventDefault(); commitTextAnnotation(); }}
                              style={{ padding: '4px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    </React.Fragment>
                  );
                });
              };

              if (pageTransition === 'continuous') {
                return (
                  <div style={{ 
                    position: 'relative', width: '100%', height: `${rowLayout.total}px`
                  }}>
                    {rows.map((row, rIndex) => renderRow(row, rIndex, true))}
                  </div>
                );
              } else {
                const currentRowIndex = Math.max(0, rows.findIndex(row => row.includes(pageNum)));
                const currentRow = rows[currentRowIndex] || [];
                return (
                  <div style={{ 
                    position: 'relative', width: '100%', minHeight: `${rowLayout.heights[currentRowIndex] ?? 0}px`
                  }}>
                    {renderRow(currentRow, currentRowIndex, false)}
                  </div>
                );
              }
            })()}
          </div>
          
          {/* Pagination Controls for Page-By-Page */}
          {pageTransition === 'page-by-page' && pdfDoc && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              padding: '8px 16px',
              borderRadius: '24px',
              color: '#fff',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <button 
                onClick={() => setPageNum(Math.max(1, pageNum - 1))}
                disabled={pageNum <= 1}
                style={{ background: 'none', border: 'none', color: pageNum <= 1 ? '#888' : '#fff', cursor: pageNum <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                Page {pageNum} of {pdfDoc.numPages}
              </span>
              <button 
                onClick={() => setPageNum(Math.min(pdfDoc.numPages, pageNum + 1))}
                disabled={pageNum >= pdfDoc.numPages}
                style={{ background: 'none', border: 'none', color: pageNum >= pdfDoc.numPages ? '#888' : '#fff', cursor: pageNum >= pdfDoc.numPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          
          {/* Modals and Overlays */}  
            {!pdfDoc && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                padding: '24px',
                textAlign: 'center'
              }}>
                {loadError ? (
                  <>
                    <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                      {loadError.name === 'PasswordException' ? 'This document is password protected.' : 'The document could not be loaded.'}
                    </div>
                    <div style={{ fontSize: '12px', maxWidth: '480px', wordBreak: 'break-word' }}>{loadError.message}</div>
                  </>
                ) : initialDoc ? 'Loading document…' : 'No document loaded.'}
              </div>
            )}

            {/* Pagination Floating Overlay (positioned within the viewer, not the window) */}
            {pdfDoc && (
              <div style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(4px)'
              }}>
                <button 
                  onClick={() => scrollToPage(Math.max(1, pageNum - 1))}
                  disabled={pageNum <= 1}
                  style={{ background: 'none', border: 'none', color: pageNum <= 1 ? 'rgba(255,255,255,0.3)' : 'white', cursor: pageNum <= 1 ? 'default' : 'pointer', display: 'flex', padding: 0 }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                  Page {pageNum} / {pdfDoc.numPages}
                </span>
                <button 
                  onClick={() => scrollToPage(Math.min(pdfDoc.numPages, pageNum + 1))}
                  disabled={pageNum >= pdfDoc.numPages}
                  style={{ background: 'none', border: 'none', color: pageNum >= pdfDoc.numPages ? 'rgba(255,255,255,0.3)' : 'white', cursor: pageNum >= pdfDoc.numPages ? 'default' : 'pointer', display: 'flex', padding: 0 }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
            
            {/* Annotation Context Menu */}
            {selectedAnnotationId && contextMenuPos && (
              <AnnotationContextMenu
                annotation={annotations.find(a => a.id === selectedAnnotationId)!}
                position={contextMenuPos}
                onCopy={() => {
                  const annToCopy = annotations.find(a => a.id === selectedAnnotationId);
                  if (annToCopy) {
                    const newAnn = { ...annToCopy, id: newAnnotationId(), author: undefined, authorId: undefined, createdAt: undefined, modifiedAt: undefined, readOnly: undefined, xfdfExtras: undefined, x: annToCopy.x + 20, y: annToCopy.y + 20 };
                    commitAnnotations([...annotations, newAnn]);
                  }
                  setSelectedAnnotationId(null);
                  setContextMenuPos(null);
                }}
                onDelete={() => {
                  commitAnnotations(annotations.filter(a => a.id !== selectedAnnotationId));
                  setSelectedAnnotationId(null);
                  setContextMenuPos(null);
                }}
                onUpdateColor={(color: string) => {
                  commitAnnotations(annotations.map(a => a.id === selectedAnnotationId ? { ...a, color } : a));
                }}
                onOpenLinkModal={() => {
                  setIsLinkModalOpen(true);
                  setContextMenuPos(null);
                }}
                permissions={permissions}
              />
            )}
            {compareState.isActive && compareState.showCurtain && (
              <CompareCurtainSlider
                positionPercent={compareState.curtainPosition}
                onChangePosition={(pos) => setCompareState(prev => ({ ...prev, curtainPosition: pos }))}
                containerRef={containerRef}
              />
            )}
          </div>
        </>
      )}

      {compareState.isActive && (
        <DiffSummarySidebar
          isOpen={isDiffSidebarOpen}
          onClose={() => setIsDiffSidebarOpen(false)}
          diffItems={compareState.diffItems}
          textDiffs={textDiffs}
          currentDiffIndex={compareState.currentDiffIndex}
          onSelectDiff={(idx) => setCompareState(prev => ({ ...prev, currentDiffIndex: idx }))}
          onJumpToPage={(p) => setPageNum(p)}
        />
      )}
      </div>
      
      {isLinkModalOpen && selectedAnnotationId && (
        <InsertLinkModal
          initialUrl={annotations.find(a => a.id === selectedAnnotationId)?.linkUrl || ''}
          initialText={annotations.find(a => a.id === selectedAnnotationId)?.text || ''}
          showTextInput={!annotations.find(a => a.id === selectedAnnotationId)?.width || annotations.find(a => a.id === selectedAnnotationId)?.text === '' || annotations.find(a => a.id === selectedAnnotationId)?.text !== undefined}
          onClose={() => {
            const ann = annotations.find(a => a.id === selectedAnnotationId);
            if (ann && !ann.linkUrl) {
               commitAnnotations(annotations.filter(a => a.id !== selectedAnnotationId));
            }
            setIsLinkModalOpen(false);
            setSelectedAnnotationId(null);
          }}
          onSave={(url, text) => {
            commitAnnotations(annotations.map(a => {
              if (a.id === selectedAnnotationId) {
                const newText = text !== undefined ? text : a.text;
                const newWidth = newText ? Math.max(100, newText.length * 8 + 20) : a.width;
                return { ...a, linkUrl: url, text: newText, width: newWidth };
              }
              return a;
            }));
            setIsLinkModalOpen(false);
            setSelectedAnnotationId(null);
          }}
        />
      )}
      {sidebars && (
        <Sidebar
          isOpen={rightSidebarOpen}
          activeTab={sidebarTab}
          setActiveTab={setSidebarTab}
          annotations={annotations}
          setAnnotations={commitAnnotations}
          selectedAnnotationId={selectedAnnotationId}
          setSelectedAnnotationId={setSelectedAnnotationId}
          onSearch={search}
          searchResults={searchResults}
          isSearching={isSearching}
          searchProgress={searchProgress}
          onResultClick={handleSearchResultClick}
        />
      )}
    </div>
  );
}

function ToolButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', border: 'none', borderRadius: '4px',
        backgroundColor: active ? '#e6f0fa' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-color)',
        cursor: 'pointer'
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {icon}
    </button>
  );
}


