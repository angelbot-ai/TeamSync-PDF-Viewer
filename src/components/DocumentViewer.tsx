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
import type { Redaction, WatermarkOptions, SDKPermissions, PdfAssetPaths, TransientHighlight } from '../core/types';
import { findRegexRedactions } from '../utils/findRegexRedactions';
import { convertToUnrotated, convertToRotated, normalizeRotation } from '../utils/rotationUtils';
import { clampScale, calculateScrollCompensation } from '../utils/zoomUtils';
import { estimatePageDimensions, computeRowLayout, DEFAULT_FALLBACK_DIMS } from '../utils/layoutUtils';
import { useViewerBus, useBusEvent } from '../hooks/useViewerBus';
import { assertWorkerConfigured, configurePdfAssets, getDocumentParams } from '../core/pdfAssets';
import SideBySideViewer from './SideBySideViewer';
import CompareToolbar from './CompareToolbar';
import DiffSummarySidebar from './DiffSummarySidebar';
import CompareCurtainSlider from './CompareCurtainSlider';
import DiffHighlightOverlay from './DiffHighlightOverlay';
import type { CompareState, TextDiffSegment, DiffItem, DiffBoundingBox } from '../types/compare';
import { computeTextDiff, computePageDiffBoxes } from '../utils/pdfDiffEngine';

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
  /** Fires whenever any page canvas has finished rendering. */
  onPageRendered?: (pageNumber: number) => void;
  onPageChange?: (pageNumber: number, numPages: number) => void;
  pageTransition: 'continuous' | 'page-by-page';
  pageLayout: 'single' | 'double' | 'cover-facing';
  rotation: number;
  setRotation: (r: number | ((prev: number) => number)) => void;
  watermark?: WatermarkOptions;
  watermarkText?: string;
  enableAnnotations?: boolean;
  initialPage?: number;
  page?: number;
  transientHighlights?: TransientHighlight[];
  permissions?: SDKPermissions;
  /** Whether to hide annotations and transient highlights until the page canvas has finished rendering. Default: true. */
  hideAnnotationsUntilPageRendered?: boolean;
}

export default function DocumentViewer({
  leftSidebarOpen, rightSidebarOpen, activeTab, annotationManager, initialDoc, loadNonce = 0, withCredentials = false, assets, sidebars = true,
  redactions, regexRedactions, scale, setScale, sidebarTab, setSidebarTab, onAnnotationsChange, onRedactionsChange,
  onDocumentLoaded, onLoadError, onFirstPageRendered, onPageRendered, onPageChange,
  pageTransition, pageLayout, rotation, setRotation, watermark, watermarkText, enableAnnotations: _enableAnnotations, initialPage, page, transientHighlights, permissions,
  hideAnnotationsUntilPageRendered = true
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bus = useViewerBus();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [manualRedactions, setManualRedactions] = useState<Redaction[]>([]);
  const { getCommand } = useShortcuts();

  // Compare Mode State
  const [pdfDocB, setPdfDocB] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [compareState, setCompareState] = useState<CompareState>({
    isActive: false,
    mode: 'overlay',
    colorA: '#e11d48',
    colorB: '#2563eb',
    opacityA: 0.8,
    opacityB: 0.8,
    blendMode: 'difference',
    showCurtain: false,
    curtainPosition: 50,
    diffItems: [],
    currentDiffIndex: 0
  });
  const [textDiffs, setTextDiffs] = useState<TextDiffSegment[]>([]);
  const [isDiffSidebarOpen, setIsDiffSidebarOpen] = useState(false);

  // Latest-callback refs: parents may pass inline functions without re-triggering effects.
  const callbacksRef = useRef({ onRedactionsChange, onDocumentLoaded, onLoadError, onFirstPageRendered, onPageRendered, onPageChange });
  callbacksRef.current = { onRedactionsChange, onDocumentLoaded, onLoadError, onFirstPageRendered, onPageRendered, onPageChange };
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

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
      callbacksRef.current.onDocumentLoaded?.(loadedDocA, typeof docSource === 'string' ? docSource : 'documentA.pdf');
    } catch (err: any) {
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
      setCompareState(prev => ({
        ...prev,
        isActive: true,
        diffItems: [
          { id: 'diff-1', pageIndex: 1, type: 'modification', description: 'Page 1 Differences detected' }
        ]
      }));
      setIsDiffSidebarOpen(true);
    } catch (err: any) {
      console.error('Failed to load comparison document B:', err);
    }
  }, [withCredentials]);

  useEffect(() => {
    if (compareState.isActive && pdfDoc && pdfDocB) {
      let cancelled = false;
      const computeAllDiffs = async () => {
        try {
          const totalPages = Math.min(pdfDoc.numPages, pdfDocB.numPages);
          let allSummary: DiffItem[] = [];
          const mapA: Record<number, DiffBoundingBox[]> = {};
          const mapB: Record<number, DiffBoundingBox[]> = {};

          for (let p = 1; p <= totalPages; p++) {
            const { diffsA, diffsB, summary } = await computePageDiffBoxes(pdfDoc, pdfDocB, p);
            if (cancelled) return;
            mapA[p] = diffsA;
            mapB[p] = diffsB;
            allSummary = allSummary.concat(summary);
          }

          if (!cancelled) {
            setCompareState(prev => ({
              ...prev,
              diffItems: allSummary,
              pageDiffsA: mapA,
              pageDiffsB: mapB
            }));
          }

          const pA = await pdfDoc.getPage(pageNum);
          const pB = await pdfDocB.getPage(Math.min(pageNum, pdfDocB.numPages));
          const textContentA = await pA.getTextContent();
          const textContentB = await pB.getTextContent();

          const strA = textContentA.items.map((i: any) => i.str).join(' ');
          const strB = textContentB.items.map((i: any) => i.str).join(' ');

          const diffs = computeTextDiff(strA, strB, pageNum);
          if (!cancelled) setTextDiffs(diffs);
        } catch (e) {
          console.error('Error computing document diffs:', e);
        }
      };
      computeAllDiffs();
      return () => { cancelled = true; };
    }
  }, [compareState.isActive, pdfDoc, pdfDocB, pageNum]);

  // Public Event Listeners for Compare APIs
  useEffect(() => {
    const handleStartCompare = (data: any) => {
      const { docA, docB, options } = data || {};
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
        loadDocA(docA);
      }
      if (docB) {
        loadCompareDoc(docB);
      }
    };

    const handleStopCompare = () => {
      setCompareState(prev => ({ ...prev, isActive: false }));
      setPdfDocB(null);
      setTextDiffs([]);
    };

    const handleSetCompareMode = (mode: string) => {
      if (mode) setCompareState(prev => ({ ...prev, mode: mode as any }));
    };

    const handleSetCompareColors = (colorA: string, colorB: string) => {
      if (colorA && colorB) setCompareState(prev => ({ ...prev, colorA, colorB }));
    };

    const offStart = bus.on('action-start-compare', handleStartCompare);
    const offStop = bus.on('action-stop-compare', handleStopCompare);
    const offMode = bus.on<{ mode: string }>('action-set-compare-mode', (d) => d && handleSetCompareMode(d.mode));
    const offColors = bus.on<{ colorA: string; colorB: string }>('action-set-compare-colors', (d) => d && handleSetCompareColors(d.colorA, d.colorB));

    const windowStart = (e: any) => handleStartCompare(e.detail);
    const windowStop = () => handleStopCompare();
    const windowMode = (e: any) => handleSetCompareMode(e.detail?.mode);
    const windowColors = (e: any) => handleSetCompareColors(e.detail?.colorA, e.detail?.colorB);

    window.addEventListener('action-start-compare', windowStart);
    window.addEventListener('action-stop-compare', windowStop);
    window.addEventListener('action-set-compare-mode', windowMode);
    window.addEventListener('action-set-compare-colors', windowColors);

    return () => {
      offStart(); offStop(); offMode(); offColors();
      window.removeEventListener('action-start-compare', windowStart);
      window.removeEventListener('action-stop-compare', windowStop);
      window.removeEventListener('action-set-compare-mode', windowMode);
      window.removeEventListener('action-set-compare-colors', windowColors);
    };
  }, [bus, loadDocA, loadCompareDoc]);

  // Provide combinedRedactions to usePdfSearch but wait, combinedRedactions is computed later in the file.
  // We can just move the combinedRedactions useMemo up before usePdfSearch, 
  // or we can pass an empty array initially and it will update.
  // Let's just move usePdfSearch below combinedRedactions.
  const [activeSearchResult, setActiveSearchResult] = useState<SearchResult | null>(null);

  // Per-page base dimensions (scale 1, UI rotation composed with the page's /Rotate). Index =
  // pageNumber - 1. Populated progressively after load so mixed-size documents lay out correctly.
  const [pageDims, setPageDims] = useState<Array<{ width: number; height: number }>>([]);
  const fallbackDims = pageDims[0] ?? DEFAULT_FALLBACK_DIMS;
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
    return computeRowLayout(rows, dimsFor, scale, GAP);
  }, [rows, scale, dimsFor]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const rowLayoutRef = useRef(rowLayout);
  rowLayoutRef.current = rowLayout;
  const pageTransitionRef = useRef(pageTransition);
  pageTransitionRef.current = pageTransition;
  const visibleRowRef = useRef(0);

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

  const scrollToPage = useCallback((p: number, options: { smooth?: boolean } = {}) => {
    const clampedPage = pdfDoc ? Math.max(1, Math.min(p, pdfDoc.numPages)) : Math.max(1, p);
    setPageNum(clampedPage);
    const i = rowIndexOfPage(clampedPage);
    if (i >= 0 && containerRef.current) {
      if (options.smooth) {
        containerRef.current.scrollTo({ top: rowLayout.tops[i], behavior: 'smooth' });
      } else {
        containerRef.current.scrollTop = rowLayout.tops[i];
      }
    }
  }, [pdfDoc, rowIndexOfPage, rowLayout]);

  useEffect(() => {
    const handleGoToPage = (detail?: { page: number; smooth?: boolean }) => {
      if (detail?.page) {
        scrollToPage(detail.page, { smooth: detail.smooth ?? true });
      }
    };
    const offGoToPage = bus.on<{ page: number; smooth?: boolean }>('action-go-to-page', (d) => handleGoToPage(d));
    const windowGoToPage = (e: any) => handleGoToPage(e.detail);
    window.addEventListener('action-go-to-page', windowGoToPage);

    return () => {
      offGoToPage();
      window.removeEventListener('action-go-to-page', windowGoToPage);
    };
  }, [bus, scrollToPage]);

  const handleSearchResultClick = (result: SearchResult) => {
    setPageNum(result.pageIndex);
    setActiveSearchResult(result);
    scrollToPage(result.pageIndex);
  };

  const handleSelectDiff = useCallback((idx: number, item?: DiffItem) => {
    const diffItem = item || compareState.diffItems[idx];
    setCompareState(prev => ({ ...prev, currentDiffIndex: idx }));

    if (!diffItem) return;

    if (diffItem.pageIndex && diffItem.pageIndex !== pageNum) {
      setPageNum(diffItem.pageIndex);
    }

    const targetY = (diffItem.y ?? 0) * scale;
    const targetX = (diffItem.x ?? 0) * scale;

    if (containerRef.current) {
      const p = diffItem.pageIndex || pageNum;
      const rIdx = rowIndexOfPage(p);
      const rowTop = pageTransition === 'continuous' && rIdx >= 0 ? (rowLayout.tops[rIdx] ?? 0) : 0;
      const viewHeight = containerRef.current.clientHeight || 600;
      const viewWidth = containerRef.current.clientWidth || 800;

      const scrollToY = Math.max(0, rowTop + targetY - viewHeight / 3);
      const scrollToX = Math.max(0, targetX - viewWidth / 4);

      containerRef.current.scrollTo({
        top: scrollToY,
        left: scrollToX,
        behavior: 'smooth'
      });
    }
  }, [compareState.diffItems, pageNum, scale, pageTransition, rowIndexOfPage, rowLayout.tops]);

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
  const clipboardAnnotationRef = useRef<Annotation | null>(null);


  useBusEvent<{ tool: typeof activeTool }>('action-set-tool', (d) => setActiveTool(d?.tool ?? null));

  const zoomFocusRef = useRef<{vx: number | null, vy: number | null}>({ vx: null, vy: null });
  const prevScaleRef = useRef(scale);
  const isProgrammaticScaleRef = useRef(false);
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [pdfDoc]);

  // Unified scroll offset maintenance for user-driven scale changes (wheel or toolbar)
  useEffect(() => {
    if (prevScaleRef.current !== scale) {
      const s = prevScaleRef.current;
      const newScale = scale;
      prevScaleRef.current = scale;
      
      const container = containerRef.current;
      if (!container) return;

      const isProgrammatic = isProgrammaticScaleRef.current || !initialFitDoneRef.current || initialScrollDoneRef.current !== pdfDoc;
      initialFitDoneRef.current = true;
      isProgrammaticScaleRef.current = false;

      const newPos = calculateScrollCompensation({
        prevScale: s,
        newScale,
        containerWidth: container.clientWidth,
        containerHeight: container.clientHeight,
        currentScrollLeft: container.scrollLeft,
        currentScrollTop: container.scrollTop,
        basePageWidth: dimsFor(pageNum).width,
        focusPoint: zoomFocusRef.current,
        isProgrammatic,
      });

      zoomFocusRef.current = { vx: null, vy: null };

      if (isProgrammatic && pageNum > 1 && pageTransition === 'continuous') {
        const rIdx = rowIndexOfPage(pageNum);
        if (rIdx >= 0) {
          container.scrollTop = rowLayout.tops[rIdx] ?? 0;
        }
        container.scrollLeft = 0;
      } else {
        container.scrollLeft = newPos.scrollLeft;
        container.scrollTop = newPos.scrollTop;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        
        const multiplier = Math.exp(-e.deltaY * 0.002);
        
        setScale(s => {
          const roundedScale = clampScale(s * multiplier);
          if (roundedScale !== s) {
            zoomFocusRef.current = { 
              vx: clientX - rect.left, 
              vy: clientY - rect.top 
            };
          }
          return roundedScale;
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
    if (matchShortcut(e, getCommand('SEARCH'))) {
      e.preventDefault();
      bus.emit('action-open-search');
      return;
    }
    if (matchShortcut(e, getCommand('FILE_PICKER'))) {
      e.preventDefault();
      bus.emit('action-open-file-picker');
      return;
    }

    // Annotation clipboard & manipulation (only when not typing in text fields)
    if (!isInput && !activeTextEditor) {
      if (matchShortcut(e, getCommand('COPY')) && selectedAnnotationId) {
        const annToCopy = annotations.find(a => a.id === selectedAnnotationId);
        if (annToCopy) {
          e.preventDefault();
          clipboardAnnotationRef.current = annToCopy;
        }
        return;
      }
      if (matchShortcut(e, getCommand('PASTE')) && clipboardAnnotationRef.current) {
        e.preventDefault();
        const base = clipboardAnnotationRef.current;
        const newAnn: Annotation = {
          ...base,
          id: newAnnotationId(),
          pageIndex: pageNum,
          x: base.x + 20,
          y: base.y + 20,
          author: undefined,
          authorId: undefined,
          createdAt: undefined,
          modifiedAt: undefined,
          readOnly: undefined,
          xfdfExtras: undefined
        };
        commitAnnotations([...annotations, newAnn]);
        setSelectedAnnotationId(newAnn.id);
        return;
      }
      if (matchShortcut(e, getCommand('DELETE')) && selectedAnnotationId) {
        e.preventDefault();
        commitAnnotations(annotations.filter(a => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
        return;
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

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchResult(null);
    }
  }, [searchResults]);

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
        try {
          const p1 = await doc.getPage(1);
          if (!cancelled) {
            const vp1 = p1.getViewport({ scale: 1, rotation: normalizeRotation(p1.rotate + rotation) });
            setPageDims(estimatePageDimensions(doc.numPages, { width: vp1.width, height: vp1.height }));
          }
        } catch {}
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
  }, [initialDoc, loadNonce, withCredentials, rotation]);

  const handlePageRendered = useCallback((renderedPage: number) => {
    callbacksRef.current.onPageRendered?.(renderedPage);
    if (firstPageRenderedRef.current) return;
    firstPageRenderedRef.current = true;
    callbacksRef.current.onFirstPageRendered?.(renderedPage);
  }, []);

  useEffect(() => {
    if (pdfDoc) callbacksRef.current.onPageChange?.(pageNum, pdfDoc.numPages);
  }, [pageNum, pdfDoc]);

  // Scroll to the target page (page ?? initialPage) as soon as row geometry is known,
  // and handle subsequent page/initialPage prop updates when citations are clicked.
  const initialScrollDoneRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const lastTargetPageRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const target = page ?? initialPage;
    if (!pdfDoc || !target) return;
    if (initialScrollDoneRef.current === pdfDoc && lastTargetPageRef.current === target) return;
    if (pageDims.length < Math.min(target, pdfDoc.numPages)) return;

    const isInitial = initialScrollDoneRef.current !== pdfDoc;
    initialScrollDoneRef.current = pdfDoc;
    lastTargetPageRef.current = target;
    const t = setTimeout(() => scrollToPage(target, { smooth: !isInitial }), 50);
    return () => clearTimeout(t);
  }, [pdfDoc, page, initialPage, pageDims.length, scrollToPage]);

  // Measure base dimensions up front and reserve estimated space for all pages to avoid layout jumps / shaking on scroll.
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const doc = pdfDoc;

    (async () => {
      // 1. Measure Page 1 up front to obtain baseline page dimensions
      let p1: pdfjsLib.PDFPageProxy;
      try {
        p1 = await doc.getPage(1);
      } catch {
        return;
      }
      if (cancelled) return;

      const vp1 = p1.getViewport({ scale: 1, rotation: normalizeRotation(p1.rotate + rotation) });
      const p1Dim = { width: vp1.width, height: vp1.height };

      // 2. Reserve estimated space up front for all pages based on Page 1
      setPageDims((prev) => {
        if (
          prev.length === doc.numPages &&
          Math.abs((prev[0]?.width ?? 0) - p1Dim.width) <= 0.5 &&
          Math.abs((prev[0]?.height ?? 0) - p1Dim.height) <= 0.5
        ) {
          return prev;
        }
        return estimatePageDimensions(doc.numPages, p1Dim);
      });

      if (doc.numPages <= 1) return;

      // 3. Measure remaining page dimensions up front in parallel batches
      const allDims = estimatePageDimensions(doc.numPages, p1Dim);
      let mismatch = false;
      const batchSize = 25;

      for (let start = 2; start <= doc.numPages; start += batchSize) {
        if (cancelled) return;
        const end = Math.min(doc.numPages, start + batchSize - 1);
        const batchPromises: Promise<void>[] = [];

        for (let p = start; p <= end; p++) {
          const pageNum = p;
          batchPromises.push((async () => {
            try {
              const page = await doc.getPage(pageNum);
              if (cancelled) return;
              const vp = page.getViewport({ scale: 1, rotation: normalizeRotation(page.rotate + rotation) });
              if (Math.abs(vp.width - p1Dim.width) > 0.5 || Math.abs(vp.height - p1Dim.height) > 0.5) {
                mismatch = true;
              }
              allDims[pageNum - 1] = { width: vp.width, height: vp.height };
            } catch {
              // Retain estimated p1Dim
            }
          })());
        }

        await Promise.all(batchPromises);
      }

      if (cancelled) return;

      // 4. Update pageDims only if any page had different dimensions than the page 1 estimate
      if (mismatch) {
        const container = containerRef.current;
        if (container && container.scrollTop > 0 && pageTransitionRef.current === 'continuous') {
          const cRow = visibleRowRef.current;
          const newLayout = computeRowLayout(
            rowsRef.current,
            (p) => allDims[p - 1] ?? p1Dim,
            scaleRef.current,
            GAP
          );
          const oldTop = rowLayoutRef.current.tops[cRow] ?? 0;
          const newTop = newLayout.tops[cRow] ?? 0;
          const delta = newTop - oldTop;
          if (delta !== 0) {
            container.scrollTop += delta;
          }
        }
        setPageDims(allDims);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, rotation]);

  // Dynamic Fit to Width calculation
  const handleFitToWidth = useCallback(() => {
    const dims = dimsFor(pageNum);
    if (!containerRef.current || !dims.width) return;
    const availableWidth = containerRef.current.clientWidth - 48;
    if (availableWidth > 0 && dims.width > 0) {
      const newScale = clampScale(availableWidth / dims.width);
      isProgrammaticScaleRef.current = true;
      if (containerRef.current && (pageNum === 1 || containerRef.current.scrollTop <= 1)) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
      setScale(newScale);
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
      const newScale = clampScale(Math.min(scaleX, scaleY));
      isProgrammaticScaleRef.current = true;
      if (containerRef.current && (pageNum === 1 || containerRef.current.scrollTop <= 1)) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
      }
      setScale(newScale);
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
          setPageNum={(p) => scrollToPage(p)}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
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
            handleSelectDiff(newIdx);
          }}
          onNextDiff={() => {
            if (compareState.diffItems.length === 0) return;
            const newIdx = (compareState.currentDiffIndex + 1) % compareState.diffItems.length;
            handleSelectDiff(newIdx);
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
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
            diffsA={compareState.pageDiffsA?.[pageNum] || []}
            diffsB={compareState.pageDiffsB?.[pageNum] || []}
            selectedDiffId={compareState.diffItems[compareState.currentDiffIndex]?.id}
            onSelectDiff={(id) => {
              const idx = compareState.diffItems.findIndex(d => d.id === id);
              if (idx !== -1) handleSelectDiff(idx);
            }}
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
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
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
                  // Scale-aware virtualization buffer: at high zoom levels each page is enormous,
                  // so a smaller row buffer prevents mounting excessive gigantic canvas elements in DOM.
                  const bufferBefore = scale >= 4 ? 1 : scale >= 2 ? 2 : 4;
                  const bufferAfter = scale >= 4 ? 1 : scale >= 2 ? 2 : 5;
                  if (rIndex < visibleRowRef.current - bufferBefore || rIndex > visibleRowRef.current + bufferAfter) {
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
                        transientHighlights={transientHighlights?.filter(h => h.pageIndex === p) || []}
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
                        hideAnnotationsUntilPageRendered={hideAnnotationsUntilPageRendered}
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
                      {compareState.isActive && (
                        <div style={{
                          position: 'absolute',
                          top: `${rTop}px`,
                          left: pLeft !== undefined ? `${pLeft}px` : '0px',
                          width: `${pageDim.width * scale}px`,
                          height: `${pageDim.height * scale}px`,
                          pointerEvents: 'none',
                          zIndex: 16
                        }}>
                          <DiffHighlightOverlay
                            boxes={[
                              ...(compareState.pageDiffsA?.[p] || []),
                              ...(compareState.pageDiffsB?.[p] || [])
                            ]}
                            scale={scale}
                            selectedDiffId={compareState.diffItems[compareState.currentDiffIndex]?.id}
                            onSelectDiff={(id) => {
                              const idx = compareState.diffItems.findIndex(d => d.id === id);
                              if (idx !== -1) handleSelectDiff(idx);
                            }}
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
          onSelectDiff={(idx, item) => handleSelectDiff(idx, item)}
          onJumpToPage={(p) => scrollToPage(p)}
        />
      )}
      </div>
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


