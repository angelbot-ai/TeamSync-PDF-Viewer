/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Pen, Type, Minus, Eraser, Square, Circle as CircleIcon, Highlighter, ChevronLeft, ChevronRight, Brush, MessageSquareQuote, ArrowUpRight, ShieldCheck, Link as LinkIcon, EyeOff, Trash2 } from 'lucide-react';
import AnnotationContextMenu from './AnnotationContextMenu';
import InsertLinkModal from './InsertLinkModal';
import TextSelectionMenu from './TextSelectionMenu';
import { matchShortcut, useShortcuts } from '../hooks/useShortcuts';
import Sidebar from './Sidebar';
import LeftSidebar from './LeftSidebar';
import { usePdfSearch, type SearchResult } from '../hooks/usePdfSearch';
import PageRenderer, { type Annotation } from './PageRenderer';
import type { Redaction, WatermarkOptions, SDKPermissions } from '../main';
import { findRegexRedactions } from '../utils/findRegexRedactions';

// Configure the worker locally via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface DocumentViewerProps {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  activeTab: string;
  initialDoc?: string;
  redactions?: Redaction[];
  regexRedactions?: RegExp[];
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  sidebarTab: 'Comments' | 'Search';
  setSidebarTab: (tab: 'Comments' | 'Search') => void;
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  pageTransition: 'continuous' | 'page-by-page';
  pageLayout: 'single' | 'double' | 'cover-facing';
  rotation: number;
  setRotation: (r: number | ((prev: number) => number)) => void;
  watermark?: WatermarkOptions;
  watermarkText?: string;
  enableAnnotations?: boolean;
  initialPage?: number;
  permissions?: SDKPermissions;
}

export default function DocumentViewer({ 
  leftSidebarOpen, rightSidebarOpen, activeTab, initialDoc, redactions, regexRedactions, scale, setScale, sidebarTab, setSidebarTab, onAnnotationsChange,
  pageTransition, pageLayout, rotation, setRotation, watermark, watermarkText, enableAnnotations, initialPage, permissions
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [manualRedactions, setManualRedactions] = useState<Redaction[]>([]);
  const { getCommand } = useShortcuts();

  // Provide combinedRedactions to usePdfSearch but wait, combinedRedactions is computed later in the file.
  // We can just move the combinedRedactions useMemo up before usePdfSearch, 
  // or we can pass an empty array initially and it will update.
  // Let's just move usePdfSearch below combinedRedactions.
  const [activeSearchResult, setActiveSearchResult] = useState<SearchResult | null>(null);

  const [basePageDims, setBasePageDims] = useState({ width: 800, height: 1100 });
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number, y: number, scrollLeft: number, scrollTop: number } | null>(null);

  const handleSearchResultClick = (result: SearchResult) => {
    setPageNum(result.pageIndex);
    setActiveSearchResult(result);
    if (containerRef.current) {
      const GAP = 16;
      const scaledPageHeight = basePageDims.height * scale + GAP;
      containerRef.current.scrollTop = (result.pageIndex - 1) * scaledPageHeight;
    }
  };

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
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
    window.dispatchEvent(new CustomEvent('action-tool-changed', { detail: { tool: activeTool } }));
  }, [activeTool]);
  


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

  // Selection State
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const justCreatedLinkRef = useRef(false);
  const [textSelection, setTextSelection] = useState<{ text: string, top: number, left: number, pageIndex: number, rects: DOMRect[] } | null>(null);


  useEffect(() => {
    const handleSetTool = (e: any) => setActiveTool(e.detail.tool);
    window.addEventListener('action-set-tool', handleSetTool);
    return () => window.removeEventListener('action-set-tool', handleSetTool);
  }, []);

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
        
        const baseW = basePageDims.width;
        const pLeft1 = Math.max(0, cW / 2 - (baseW * s) / 2);
        const pLeft2 = Math.max(0, cW / 2 - (baseW * newScale) / 2);
        
        const pageX = x - pLeft1;
        const newPageX = pageX * (newScale / s);
        const newX = pLeft2 + newPageX;
        
        container.scrollLeft = newX - vx;
        container.scrollTop = (y * (newScale / s)) - vy;
      }
    }
  }, [scale, basePageDims.width]);

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

  // Function to commit new annotations and push to history
  const commitAnnotations = useCallback((newAnns: Annotation[]) => {
    setPast(prev => [...prev, annotations]);
    setFuture([]);
    setAnnotations(newAnns);
  }, [annotations]);

  useEffect(() => {
    const handleLocalCommit = (e: any) => {
      commitAnnotations([...annotations, e.detail.tempAnn]);
    };
    window.addEventListener('action-commit-digital-signature-local', handleLocalCommit);
    return () => window.removeEventListener('action-commit-digital-signature-local', handleLocalCommit);
  }, [annotations, commitAnnotations]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture(prev => [annotations, ...prev]);
    setAnnotations(previous);
    setPast(prev => prev.slice(0, -1));
  }, [annotations, past]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(prev => [...prev, annotations]);
    setAnnotations(next);
    setFuture(prev => prev.slice(1));
  }, [annotations, future]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [annotations, selectedAnnotationId, past, future, activeTextEditor, getCommand, setRotation, handleUndo, handleRedo, commitAnnotations]);

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
      findRegexRedactions(pdfDoc, regexRedactions).then(results => {
        setAutoRedactions(results);
        (window as any).currentAutoRedactions = results; // Share with main.tsx download handler
      });
    } else {
      setAutoRedactions([]);
      (window as any).currentAutoRedactions = [];
    }
  }, [pdfDoc, regexRedactions]);

  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);

  useEffect(() => {
    (window as any).currentManualRedactions = manualRedactions;
  }, [manualRedactions]);

  const combinedRedactions = useMemo(() => {
    return [...(redactions || []), ...autoRedactions, ...manualRedactions];
  }, [redactions, autoRedactions, manualRedactions]);

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

  // Load annotations from API once
  useEffect(() => {
    if (initialDoc) {
      const loadPdf = async () => {
        try {
          const loadingTask = pdfjsLib.getDocument({ url: initialDoc });
          const doc = await loadingTask.promise;
          setPdfDoc(doc);
        } catch (error: any) {
          console.error("Error loading PDF:", error.message || error, error);
        }
      };
      loadPdf();
    }
  }, [initialDoc]);

  // Scroll to initial page
  useEffect(() => {
    if (pdfDoc && initialPage && initialPage > 1 && containerRef.current) {
      setTimeout(() => {
        const GAP = 16;
        const scaledPageHeight = basePageDims.height * scale + GAP;
        containerRef.current!.scrollTop = (initialPage - 1) * scaledPageHeight;
      }, 100);
    }
  }, [pdfDoc, initialPage, basePageDims.height, scale]);

  // Recalculate basePageDims when pdfDoc or rotation changes
  useEffect(() => {
    if (pdfDoc) {
      const updateDims = async () => {
        const page = await pdfDoc.getPage(1);
        // We pass rotation so the viewport correctly reflects swapped dimensions if rotated 90 or 270 degrees
        const vp = page.getViewport({ scale: 1, rotation });
        setBasePageDims({ width: vp.width, height: vp.height });
      };
      updateDims();
    }
  }, [pdfDoc, rotation]);

  // Dynamic Fit to Width calculation
  const handleFitToWidth = useCallback(() => {
    if (!containerRef.current || !basePageDims.width) return;
    const availableWidth = containerRef.current.clientWidth - 48;
    if (availableWidth > 0 && basePageDims.width > 0) {
      const newScale = availableWidth / basePageDims.width;
      const clampedScale = Math.max(0.1, Math.min(32, parseFloat(newScale.toFixed(2))));
      setScale(clampedScale);
    }
  }, [basePageDims.width, setScale]);

  // Dynamic Fit to Page calculation
  const handleFitToPage = useCallback(() => {
    if (!containerRef.current || !basePageDims.width || !basePageDims.height) return;
    const availableWidth = containerRef.current.clientWidth - 48;
    const availableHeight = containerRef.current.clientHeight - 48;
    if (availableWidth > 0 && availableHeight > 0 && basePageDims.width > 0 && basePageDims.height > 0) {
      const scaleX = availableWidth / basePageDims.width;
      const scaleY = availableHeight / basePageDims.height;
      const newScale = Math.min(scaleX, scaleY);
      const clampedScale = Math.max(0.1, Math.min(32, parseFloat(newScale.toFixed(2))));
      setScale(clampedScale);
    }
  }, [basePageDims.width, basePageDims.height, setScale]);

  useEffect(() => {
    const onFitWidth = () => handleFitToWidth();
    const onFitPage = () => handleFitToPage();

    window.addEventListener('action-fit-to-width', onFitWidth);
    window.addEventListener('action-fit-to-page', onFitPage);
    return () => {
      window.removeEventListener('action-fit-to-width', onFitWidth);
      window.removeEventListener('action-fit-to-page', onFitPage);
    };
  }, [handleFitToWidth, handleFitToPage]);

  const handleMouseDown = (e: React.MouseEvent<Element>, targetPageNum: number) => {
    setTextSelection(null);
    if (!activeTool) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

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
        const annId = Date.now().toString();
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

  const handleMouseMove = (e: React.MouseEvent<Element>, _targetPageNum: number) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setCurrentPos({ x, y });
    if (activeTool === 'freehand') {
      setFreehandPoints(prev => [...prev, { x, y }]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<Element>, targetPageNum: number) => {
    if (activeTool === 'text' || activeTool === 'note' || activeTool === 'digital_signature' || activeTool === 'link') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      if (activeTool === 'link') {
        let width = Math.abs(currentPos.x - startPos.x);
        let height = Math.abs(currentPos.y - startPos.y);
        let linkX = Math.min(startPos.x, currentPos.x);
        let linkY = Math.min(startPos.y, currentPos.y);

        if (width < 5 || height < 5) {
          linkX = (e.clientX - rect.left) / scale;
          linkY = (e.clientY - rect.top) / scale;
          width = 120;
          height = 35;
        }

        const annId = Date.now().toString();
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
          id: Date.now().toString(), type: activeTool as any, pageIndex: targetPageNum,
          x: minX, y: minY, width: maxX - minX, height: maxY - minY,
          points: [...freehandPoints],
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
          id: Date.now().toString(), type: activeTool as any, pageIndex: targetPageNum, x, y, width, height, points,
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
          const GAP = 16;
          const scaledPageHeight = basePageDims.height * scale + GAP;
          if (containerRef.current) containerRef.current.scrollTop = (targetPage - 1) * scaledPageHeight;
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
        if (permissions?.canEditAnnotations === false) return;
        // Open edit mode for text-based annotations
        setActiveTextEditor({ x: ann.x, y: ann.y, type: ann.type as any, annId: ann.id, points: ann.points, pageIndex: ann.pageIndex });
        setCurrentText(ann.text || '');
        if (ann.color) setCurrentColor(ann.color);
      } else if (ann && ann.type === 'link') {
        if (permissions?.canEditAnnotations === false) return;
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
    if (basePageDims.height > 0) {
      visibleRowRef.current = Math.floor(e.currentTarget.scrollTop / (basePageDims.height * scale + 16));
    }
  };

  const rows = React.useMemo(() => {
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

  const GAP = 16;
  const scaledPageHeight = basePageDims.height * scale + GAP;
  const scaledPageWidth = basePageDims.width * scale;

  useEffect(() => {
    if (pdfDoc && containerRef.current && pageTransition === 'continuous') {
      const midPoint = scrollPos.top + containerRef.current.clientHeight / 2;
      const cRowIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(midPoint / scaledPageHeight)));
      const currentPage = rows[cRowIndex] ? rows[cRowIndex][0] : 1;
      if (currentPage !== pageNum) {
        setPageNum(currentPage);
      }
    }
  }, [scrollPos.top, scale, pdfDoc, pageNum, scaledPageHeight, pageTransition, rows]);

  return (
    <div style={{ flex: 1, display: 'flex', backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      <LeftSidebar 
        isOpen={leftSidebarOpen} 
        pdfDoc={pdfDoc}
        pageNum={pageNum}
        setPageNum={setPageNum}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
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



      {/* Main Canvas Area */}
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
              if (activeTool !== null && activeTool !== 'pan') return;
              setTimeout(() => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && selection.toString().trim() !== '') {
                  const range = selection.getRangeAt(0);
                  const rect = range.getBoundingClientRect();
                  const container = containerRef.current;
                  if (container && container.contains(selection.anchorNode)) {
                    // Try to determine which page this text belongs to
                    let pageIndex = 1;
                    const pageNodes = document.querySelectorAll('.pdf-page-container');
                    pageNodes.forEach((node, i) => {
                      if (node.contains(selection.anchorNode)) {
                        pageIndex = i + 1;
                      }
                    });

                    const rects = Array.from(range.getClientRects());
                    setTextSelection({
                      text: selection.toString(),
                      top: rect.top - container.getBoundingClientRect().top + container.scrollTop,
                      left: rect.left - container.getBoundingClientRect().left + container.scrollLeft + (rect.width / 2),
                      pageIndex,
                      rects
                    });
                  }
                } else {
                  setTextSelection(null);
                }
              }, 10);
            }}
            onContextMenu={(e) => {
              // Prevent default context menu
              e.preventDefault();
              e.stopPropagation();
              
              if (activeTab === 'View') {
                // In View mode, if text is selected, keep text selection for copy, otherwise close menu
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
                  setTextSelection(null);
                }
                return;
              }
              
              const container = containerRef.current;
              if (container) {
                const rect = container.getBoundingClientRect();
                const selection = window.getSelection();
                let selText = '';
                let pageIndex = 1;
                let rects: DOMRect[] = [];
                
                if (selection && selection.rangeCount > 0 && selection.toString().trim() !== '') {
                  selText = selection.toString();
                  const range = selection.getRangeAt(0);
                  rects = Array.from(range.getClientRects());
                  const pageNodes = document.querySelectorAll('.pdf-page-container');
                  pageNodes.forEach((node, i) => {
                    if (node.contains(selection.anchorNode)) {
                      pageIndex = i + 1;
                    }
                  });
                } else {
                  const yRaw = (e.clientY - rect.top + container.scrollTop) / scale;
                  const pageHeightRaw = basePageDims.height + (16 / scale);
                  pageIndex = Math.floor(yRaw / pageHeightRaw) + 1;
                }

                setTextSelection({
                  text: selText,
                  top: e.clientY - rect.top + container.scrollTop,
                  left: e.clientX - rect.left + container.scrollLeft,
                  pageIndex,
                  rects
                });
              }
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
                const rTop = isContinuous ? rIndex * scaledPageHeight : 0;
                
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
                  if (row.length === 2) {
                    if (pIdx === 0) pLeft = Math.max(0, cW / 2 - scaledPageWidth);
                    if (pIdx === 1) pLeft = Math.max(scaledPageWidth, cW / 2);
                  } else {
                    pLeft = Math.max(0, cW / 2 - scaledPageWidth / 2);
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
                        basePageWidth={basePageDims.width}
                        basePageHeight={basePageDims.height}
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
                      />
                      {activeTextEditor && activeTextEditor.pageIndex === p && (
                        <div style={{
                          position: 'absolute',
                          left: `${(pLeft || 0) + activeTextEditor.x * scale}px`,
                          top: `${rTop + activeTextEditor.y * scale}px`,
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
                      )}
                    </React.Fragment>
                  );
                });
              };

              if (pageTransition === 'continuous') {
                return (
                  <div style={{ 
                    position: 'relative', width: '100%', height: `${rows.length * scaledPageHeight}px`
                  }}>
                    {rows.map((row, rIndex) => renderRow(row, rIndex, true))}
                  </div>
                );
              } else {
                const currentRowIndex = Math.max(0, rows.findIndex(row => row.includes(pageNum)));
                const currentRow = rows[currentRowIndex] || [];
                return (
                  <div style={{ 
                    position: 'relative', width: '100%', minHeight: `${scaledPageHeight}px`
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
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                No document loaded.
              </div>
            )}

            {/* Pagination Floating Overlay */}
            {pdfDoc && (
              <div style={{
                position: 'fixed',
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
                  onClick={() => {
                    const GAP = 16;
                    const scaledPageHeight = basePageDims.height * scale + GAP;
                    if(containerRef.current) containerRef.current.scrollTop = (Math.max(1, pageNum - 1) - 1) * scaledPageHeight;
                  }}
                  disabled={pageNum <= 1}
                  style={{ background: 'none', border: 'none', color: pageNum <= 1 ? 'rgba(255,255,255,0.3)' : 'white', cursor: pageNum <= 1 ? 'default' : 'pointer', display: 'flex', padding: 0 }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
                  Page {pageNum} / {pdfDoc.numPages}
                </span>
                <button 
                  onClick={() => {
                    const GAP = 16;
                    const scaledPageHeight = basePageDims.height * scale + GAP;
                    if(containerRef.current) containerRef.current.scrollTop = (Math.min(pdfDoc.numPages, pageNum + 1) - 1) * scaledPageHeight;
                  }}
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
                    const newAnn = { ...annToCopy, id: Math.random().toString(36).substr(2, 9), x: annToCopy.x + 20, y: annToCopy.y + 20 };
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
                onUpdateColor={(color) => {
                  commitAnnotations(annotations.map(a => a.id === selectedAnnotationId ? { ...a, color } : a));
                }}
                onOpenLinkModal={() => {
                  setIsLinkModalOpen(true);
                  setContextMenuPos(null);
                }}
                permissions={permissions}
              />
            )}
            
            {/* Unified Text Selection & Right-Click Menu */}
            {textSelection && !isLinkModalOpen && (
              <TextSelectionMenu
                permissions={permissions}
                position={textSelection}
                isViewMode={activeTab === 'View'}
                hasText={!!textSelection.text}
                onHighlight={() => {
                  const annId = Math.random().toString(36).substr(2, 9);
                  const pageEl = document.getElementById(`pdf-page-${textSelection.pageIndex}`);
                  if (pageEl) {
                     const pageRect = pageEl.getBoundingClientRect();
                     const firstRect = textSelection.rects[0] || { left: pageRect.left, top: pageRect.top, width: 100, height: 16 };
                     const x = (firstRect.left - pageRect.left) / scale;
                     const y = (firstRect.top - pageRect.top) / scale;
                     
                     commitAnnotations([...annotations, {
                       id: annId, type: 'highlight', pageIndex: textSelection.pageIndex,
                       x: x, y: y, width: firstRect.width / scale, height: firstRect.height / scale,
                       color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity,
                       points: [], text: ''
                     }]);
                  }
                  window.getSelection()?.removeAllRanges();
                  setTextSelection(null);
                }}
                onRedact={() => {
                  const pageEl = document.getElementById(`pdf-page-${textSelection.pageIndex}`);
                  if (pageEl) {
                    const pageRect = pageEl.getBoundingClientRect();
                    const newRedactions: Redaction[] = textSelection.rects.length > 0 ? textSelection.rects.map(r => ({
                      id: `manual-sel-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                      pageIndex: textSelection.pageIndex,
                      x: (r.left - pageRect.left) / scale,
                      y: (r.top - pageRect.top) / scale,
                      width: r.width / scale,
                      height: r.height / scale,
                      status: 'pending'
                    })) : [{
                      id: `manual-sel-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                      pageIndex: textSelection.pageIndex,
                      x: (textSelection.left - (pageEl.getBoundingClientRect().left - containerRef.current!.getBoundingClientRect().left + containerRef.current!.scrollLeft)) / scale,
                      y: (textSelection.top - (pageEl.getBoundingClientRect().top - containerRef.current!.getBoundingClientRect().top + containerRef.current!.scrollTop)) / scale,
                      width: 100,
                      height: 30,
                      status: 'pending'
                    }];
                    setManualRedactions(prev => [...prev, ...newRedactions]);
                  }
                  window.getSelection()?.removeAllRanges();
                  setTextSelection(null);
                }}
                onText={() => {
                  const annId = Math.random().toString(36).substr(2, 9);
                  const pageEl = document.getElementById(`pdf-page-${textSelection.pageIndex}`);
                  if (pageEl) {
                     const pageRect = pageEl.getBoundingClientRect();
                     const firstRect = textSelection.rects[0] || { left: pageRect.left, top: pageRect.top, width: 100, height: 16 };
                     const x = (firstRect.left - pageRect.left) / scale;
                     const y = (firstRect.top - pageRect.top) / scale;
                     
                     commitAnnotations([...annotations, {
                       id: annId, type: 'text', pageIndex: textSelection.pageIndex,
                       x: x, y: y, width: 120, height: 30,
                       color: currentColor, strokeWidth: currentStrokeWidth, opacity: currentOpacity,
                       points: [], text: 'Text Annotation'
                     }]);
                  }
                  window.getSelection()?.removeAllRanges();
                  setTextSelection(null);
                }}
                onCopy={() => {
                  if (textSelection.text) {
                    navigator.clipboard.writeText(textSelection.text);
                  }
                  window.getSelection()?.removeAllRanges();
                  setTextSelection(null);
                }}
                onLink={() => {
                  let annId = Math.random().toString(36).substr(2, 9);
                  if (textSelection) {
                     const pageEl = document.getElementById(`pdf-page-${textSelection.pageIndex}`);
                     if (pageEl) {
                       const pageRect = pageEl.getBoundingClientRect();
                       const firstRect = textSelection.rects[0] || { left: pageRect.left, top: pageRect.top, width: 100, height: 30 };
                       const x = (firstRect.left - pageRect.left) / scale;
                       const y = (firstRect.top - pageRect.top) / scale;
                       
                       commitAnnotations([...annotations, {
                         id: annId, type: 'link', pageIndex: textSelection.pageIndex,
                         x: x, y: y, width: firstRect.width / scale, height: (firstRect.height || 30) / scale,
                         color: 'transparent', strokeWidth: 0, opacity: 1,
                         points: [], text: ''
                       }]);
                     }
                  }
                  justCreatedLinkRef.current = true;
                  setSelectedAnnotationId(annId);
                  setIsLinkModalOpen(true);
                  setTextSelection(null);
                }}
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


