/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { GripVertical } from 'lucide-react';
import PageRenderer from './PageRenderer';
import DiffHighlightOverlay from './DiffHighlightOverlay';
import type { SDKPermissions, WatermarkOptions, Redaction } from '../core/types';
import type { DiffBoundingBox } from '../types/compare';
import { clampScale } from '../utils/zoomUtils';

interface SideBySideViewerProps {
  pdfDocA: pdfjsLib.PDFDocumentProxy | null;
  pdfDocB: pdfjsLib.PDFDocumentProxy | null;
  pageNum: number;
  scale: number;
  rotation: number;
  basePageDims: { width: number; height: number };
  activeTab: string;
  activeTool: string | null;
  annotations: any[];
  permissions?: SDKPermissions;
  watermark?: WatermarkOptions;
  watermarkText?: string;
  redactions?: Redaction[];
  diffsA?: DiffBoundingBox[];
  diffsB?: DiffBoundingBox[];
  selectedDiffId?: string | null;
  onSelectDiff?: (id: string) => void;
  onScrollSync?: (scrollTop: number, scrollLeft: number) => void;
  hideAnnotationsUntilPageRendered?: boolean;
  is90Fit?: boolean;
  zoomMultiplier?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export default function SideBySideViewer({
  pdfDocA,
  pdfDocB,
  pageNum,
  scale,
  rotation,
  basePageDims,
  activeTab,
  activeTool,
  annotations,
  watermark,
  watermarkText,
  redactions,
  diffsA = [],
  diffsB = [],
  selectedDiffId,
  onSelectDiff,
  hideAnnotationsUntilPageRendered = true,
  is90Fit = true,
  zoomMultiplier = 1.0,
  onZoomIn,
  onZoomOut,
}: SideBySideViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  // Separator drag state (defaults to 50% split)
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [isDraggingSeparator, setIsDraggingSeparator] = useState<boolean>(false);

  // Pan tool state
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeftA: number;
    scrollTopA: number;
    scrollLeftB: number;
    scrollTopB: number;
  } | null>(null);

  // Respective panel window dimensions
  const [panelDimA, setPanelDimA] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [panelDimB, setPanelDimB] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const updatePanelDimensions = useCallback(() => {
    if (containerARef.current) {
      setPanelDimA({
        width: containerARef.current.clientWidth,
        height: containerARef.current.clientHeight,
      });
    }
    if (containerBRef.current) {
      setPanelDimB({
        width: containerBRef.current.clientWidth,
        height: containerBRef.current.clientHeight,
      });
    }
  }, []);

  useEffect(() => {
    updatePanelDimensions();

    const roA = containerARef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updatePanelDimensions)
      : null;
    const roB = containerBRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updatePanelDimensions)
      : null;

    if (roA && containerARef.current) roA.observe(containerARef.current);
    if (roB && containerBRef.current) roB.observe(containerBRef.current);

    window.addEventListener('resize', updatePanelDimensions);

    return () => {
      roA?.disconnect();
      roB?.disconnect();
      window.removeEventListener('resize', updatePanelDimensions);
    };
  }, [updatePanelDimensions, splitPercent]);

  // Synchronize scrolling between Panel A and Panel B
  useEffect(() => {
    const elA = containerARef.current;
    const elB = containerBRef.current;
    if (!elA || !elB) return;

    const syncAtoB = () => {
      if (isSyncingRef.current || isPanning) return;
      isSyncingRef.current = true;
      const maxScrollTopA = elA.scrollHeight - elA.clientHeight;
      const maxScrollTopB = elB.scrollHeight - elB.clientHeight;
      if (maxScrollTopA > 0 && maxScrollTopB > 0) {
        elB.scrollTop = (elA.scrollTop / maxScrollTopA) * maxScrollTopB;
      } else {
        elB.scrollTop = elA.scrollTop;
      }

      const maxScrollLeftA = elA.scrollWidth - elA.clientWidth;
      const maxScrollLeftB = elB.scrollWidth - elB.clientWidth;
      if (maxScrollLeftA > 0 && maxScrollLeftB > 0) {
        elB.scrollLeft = (elA.scrollLeft / maxScrollLeftA) * maxScrollLeftB;
      } else {
        elB.scrollLeft = elA.scrollLeft;
      }
      setTimeout(() => { isSyncingRef.current = false; }, 10);
    };

    const syncBtoA = () => {
      if (isSyncingRef.current || isPanning) return;
      isSyncingRef.current = true;
      const maxScrollTopA = elA.scrollHeight - elA.clientHeight;
      const maxScrollTopB = elB.scrollHeight - elB.clientHeight;
      if (maxScrollTopA > 0 && maxScrollTopB > 0) {
        elA.scrollTop = (elB.scrollTop / maxScrollTopB) * maxScrollTopA;
      } else {
        elA.scrollTop = elB.scrollTop;
      }

      const maxScrollLeftA = elA.scrollWidth - elA.clientWidth;
      const maxScrollLeftB = elB.scrollWidth - elB.clientWidth;
      if (maxScrollLeftA > 0 && maxScrollLeftB > 0) {
        elA.scrollLeft = (elB.scrollLeft / maxScrollLeftB) * maxScrollLeftA;
      } else {
        elA.scrollLeft = elB.scrollLeft;
      }
      setTimeout(() => { isSyncingRef.current = false; }, 10);
    };

    elA.addEventListener('scroll', syncAtoB);
    elB.addEventListener('scroll', syncBtoA);

    return () => {
      elA.removeEventListener('scroll', syncAtoB);
      elB.removeEventListener('scroll', syncBtoA);
    };
  }, [isPanning]);

  // Separator drag handling
  const handleSeparatorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSeparator(true);
  };

  const handleSeparatorTouchStart = (_e: React.TouchEvent) => {
    setIsDraggingSeparator(true);
  };

  const handleSeparatorDoubleClick = () => {
    setSplitPercent(50);
  };

  useEffect(() => {
    if (!isDraggingSeparator) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offsetX = e.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      setSplitPercent(Math.max(15, Math.min(85, pct)));
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!wrapperRef.current || !e.touches[0]) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offsetX = e.touches[0].clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      setSplitPercent(Math.max(15, Math.min(85, pct)));
    };

    const onDragEnd = () => {
      setIsDraggingSeparator(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onDragEnd);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onDragEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDraggingSeparator]);

  // Synchronized Pan tool handling
  const handlePanelMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'pan' && e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeftA: containerARef.current?.scrollLeft || 0,
        scrollTopA: containerARef.current?.scrollTop || 0,
        scrollLeftB: containerBRef.current?.scrollLeft || 0,
        scrollTopB: containerBRef.current?.scrollTop || 0,
      };
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      if (containerARef.current) {
        containerARef.current.scrollLeft = panStartRef.current.scrollLeftA - dx;
        containerARef.current.scrollTop = panStartRef.current.scrollTopA - dy;
      }
      if (containerBRef.current) {
        containerBRef.current.scrollLeft = panStartRef.current.scrollLeftB - dx;
        containerBRef.current.scrollTop = panStartRef.current.scrollTopB - dy;
      }
    };

    const onMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isPanning]);

  // Ctrl / Cmd + Wheel zooming support
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          onZoomIn?.();
        } else {
          onZoomOut?.();
        }
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [onZoomIn, onZoomOut]);

  // Page dimensions
  const [dimsA, setDimsA] = useState<{ width: number; height: number }>(basePageDims);
  const [dimsB, setDimsB] = useState<{ width: number; height: number }>(basePageDims);

  useEffect(() => {
    if (pdfDocA) {
      pdfDocA.getPage(pageNum).then(page => {
        const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        setDimsA({ width: vp.width, height: vp.height });
      }).catch(() => {});
    }
  }, [pdfDocA, pageNum, rotation]);

  useEffect(() => {
    if (pdfDocB) {
      pdfDocB.getPage(pageNum).then(page => {
        const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        setDimsB({ width: vp.width, height: vp.height });
      }).catch(() => {});
    }
  }, [pdfDocB, pageNum, rotation]);

  // 90% window fit calculation for each respective panel:
  // Scales the document to occupy 90% of the available width and height of its panel
  const panelW_A = panelDimA.width || (wrapperRef.current?.clientWidth ? wrapperRef.current.clientWidth * (splitPercent / 100) : 600);
  const panelH_A = panelDimA.height || (wrapperRef.current?.clientHeight || 800);
  const availableWidthA = panelW_A * 0.90;
  const availableHeightA = Math.max(100, panelH_A - 50) * 0.90;
  const fitScaleA = Math.min(
    availableWidthA / (dimsA.width || 600),
    availableHeightA / (dimsA.height || 800)
  );

  const panelW_B = panelDimB.width || (wrapperRef.current?.clientWidth ? wrapperRef.current.clientWidth * ((100 - splitPercent) / 100) : 600);
  const panelH_B = panelDimB.height || (wrapperRef.current?.clientHeight || 800);
  const availableWidthB = panelW_B * 0.90;
  const availableHeightB = Math.max(100, panelH_B - 50) * 0.90;
  const fitScaleB = Math.min(
    availableWidthB / (dimsB.width || 600),
    availableHeightB / (dimsB.height || 800)
  );

  // If in 90% fit mode, scale to 90% of respective panel window; otherwise apply manual zoom
  const effectiveScaleA = clampScale(is90Fit ? fitScaleA * zoomMultiplier : scale * zoomMultiplier);
  const effectiveScaleB = clampScale(is90Fit ? fitScaleB * zoomMultiplier : scale * zoomMultiplier);

  const scaledWidthA = (dimsA.width || 600) * effectiveScaleA;
  const scaledHeightA = (dimsA.height || 800) * effectiveScaleA;

  const scaledWidthB = (dimsB.width || 600) * effectiveScaleB;
  const scaledHeightB = (dimsB.height || 800) * effectiveScaleB;

  // Smooth scroll to selected diff box
  useEffect(() => {
    if (!selectedDiffId) return;
    const allDiffs = [...(diffsA || []), ...(diffsB || [])];
    const targetBox = allDiffs.find(d => d.id === selectedDiffId);
    if (targetBox && containerARef.current) {
      const viewH = containerARef.current.clientHeight || 600;
      const targetY = targetBox.y * effectiveScaleA;
      const scrollToY = Math.max(0, targetY - viewH / 3);
      containerARef.current.scrollTo({
        top: scrollToY,
        behavior: 'smooth'
      });
    }
  }, [selectedDiffId, diffsA, diffsB, effectiveScaleA]);

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        minHeight: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Panel A - Document A (Base) */}
      <div
        ref={containerARef}
        onMouseDown={handlePanelMouseDown}
        style={{
          width: `${splitPercent}%`,
          flexShrink: 0,
          flexGrow: 0,
          height: '100%',
          overflow: 'auto',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          boxSizing: 'border-box',
          cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : 'default',
        }}
      >
        <div style={{
          marginBottom: '8px', padding: '4px 12px', borderRadius: '4px',
          backgroundColor: '#e11d48', color: '#ffffff', fontSize: '11px', fontWeight: 600,
          userSelect: 'none',
        }}>
          Document A (Base) - Page {pageNum}
        </div>
        <div style={{
          position: 'relative',
          width: `${scaledWidthA}px`,
          height: `${scaledHeightA}px`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          backgroundColor: '#ffffff',
          transition: isDraggingSeparator ? 'none' : 'width 0.1s ease, height 0.1s ease',
        }}>
          {pdfDocA && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocA}
              scale={effectiveScaleA}
              rotation={rotation}
              scrollTop={0}
              scrollLeft={0}
              pageTop={0}
              basePageWidth={dimsA.width}
              basePageHeight={dimsA.height}
              containerWidth={scaledWidthA}
              containerHeight={scaledHeightA}
              activeTab={activeTab}
              activeTool={activeTool}
              annotations={annotations}
              selectedAnnotationId={null}
              activeSearchResult={null}
              onMouseDown={() => {}}
              onMouseMove={() => {}}
              onMouseUp={() => {}}
              onAnnotationMouseEnter={() => {}}
              onAnnotationClick={() => {}}
              onClearSelection={() => {}}
              watermark={watermark}
              watermarkText={watermarkText}
              redactions={redactions}
              hideAnnotationsUntilPageRendered={hideAnnotationsUntilPageRendered}
            />
          )}
          <DiffHighlightOverlay
            boxes={diffsA}
            scale={effectiveScaleA}
            colorScheme="deletions"
            selectedDiffId={selectedDiffId}
            onSelectDiff={onSelectDiff}
          />
        </div>
      </div>

      {/* Movable Draggable Separator */}
      <div
        onMouseDown={handleSeparatorMouseDown}
        onTouchStart={handleSeparatorTouchStart}
        onDoubleClick={handleSeparatorDoubleClick}
        style={{
          width: '12px',
          margin: '0 -6px',
          zIndex: 40,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          userSelect: 'none',
        }}
        title="Drag to resize panels • Double-click to reset (50/50)"
      >
        {/* Vertical divider line */}
        <div
          style={{
            width: '2px',
            height: '100%',
            backgroundColor: isDraggingSeparator ? '#0284c7' : '#cbd5e1',
            boxShadow: isDraggingSeparator ? '0 0 6px rgba(2, 132, 199, 0.6)' : 'none',
            transition: 'background-color 0.15s, box-shadow 0.15s',
          }}
        />

        {/* Center Grab Handle Pill */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: isDraggingSeparator ? '#0284c7' : '#ffffff',
            border: `1px solid ${isDraggingSeparator ? '#0284c7' : '#94a3b8'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDraggingSeparator ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease',
          }}
        >
          <GripVertical size={14} />
        </div>
      </div>

      {/* Panel B - Document B (Comparison) */}
      <div
        ref={containerBRef}
        onMouseDown={handlePanelMouseDown}
        style={{
          flex: 1,
          height: '100%',
          overflow: 'auto',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px',
          boxSizing: 'border-box',
          cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : 'default',
        }}
      >
        <div style={{
          marginBottom: '8px', padding: '4px 12px', borderRadius: '4px',
          backgroundColor: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: 600,
          userSelect: 'none',
        }}>
          Document B (Comparison) - Page {pageNum}
        </div>
        <div style={{
          position: 'relative',
          width: `${scaledWidthB}px`,
          height: `${scaledHeightB}px`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          backgroundColor: '#ffffff',
          transition: isDraggingSeparator ? 'none' : 'width 0.1s ease, height 0.1s ease',
        }}>
          {pdfDocB && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocB}
              scale={effectiveScaleB}
              rotation={rotation}
              scrollTop={0}
              scrollLeft={0}
              pageTop={0}
              basePageWidth={dimsB.width}
              basePageHeight={dimsB.height}
              containerWidth={scaledWidthB}
              containerHeight={scaledHeightB}
              activeTab={activeTab}
              activeTool={activeTool}
              annotations={annotations}
              selectedAnnotationId={null}
              activeSearchResult={null}
              onMouseDown={() => {}}
              onMouseMove={() => {}}
              onMouseUp={() => {}}
              onAnnotationMouseEnter={() => {}}
              onAnnotationClick={() => {}}
              onClearSelection={() => {}}
              watermark={watermark}
              watermarkText={watermarkText}
              redactions={redactions}
              hideAnnotationsUntilPageRendered={hideAnnotationsUntilPageRendered}
            />
          )}
          <DiffHighlightOverlay
            boxes={diffsB}
            scale={effectiveScaleB}
            colorScheme="additions"
            selectedDiffId={selectedDiffId}
            onSelectDiff={onSelectDiff}
          />
        </div>
      </div>
    </div>
  );
}
