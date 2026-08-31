/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PageRenderer from './PageRenderer';
import DiffHighlightOverlay from './DiffHighlightOverlay';
import type { SDKPermissions, WatermarkOptions, Redaction } from '../core/types';
import type { DiffBoundingBox } from '../types/compare';

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
  onSelectDiff
}: SideBySideViewerProps) {
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  // Synchronize scrolling between Panel A and Panel B
  useEffect(() => {
    const elA = containerARef.current;
    const elB = containerBRef.current;
    if (!elA || !elB) return;

    const syncAtoB = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      elB.scrollTop = elA.scrollTop;
      elB.scrollLeft = elA.scrollLeft;
      setTimeout(() => { isSyncingRef.current = false; }, 10);
    };

    const syncBtoA = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      elA.scrollTop = elB.scrollTop;
      elA.scrollLeft = elB.scrollLeft;
      setTimeout(() => { isSyncingRef.current = false; }, 10);
    };

    elA.addEventListener('scroll', syncAtoB);
    elB.addEventListener('scroll', syncBtoA);

    return () => {
      elA.removeEventListener('scroll', syncAtoB);
      elB.removeEventListener('scroll', syncBtoA);
    };
  }, []);

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

  const scaledWidthA = (dimsA.width || 600) * scale;
  const scaledHeightA = (dimsA.height || 800) * scale;

  const scaledWidthB = (dimsB.width || 600) * scale;
  const scaledHeightB = (dimsB.height || 800) * scale;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Panel A - Document A (Base) */}
      <div
        ref={containerARef}
        style={{
          flex: 1,
          height: '100%',
          overflow: 'auto',
          backgroundColor: '#f1f5f9',
          borderRight: '2px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px'
        }}
      >
        <div style={{
          marginBottom: '8px', padding: '4px 12px', borderRadius: '4px',
          backgroundColor: '#e11d48', color: '#ffffff', fontSize: '11px', fontWeight: 600
        }}>
          Document A (Base) - Page {pageNum}
        </div>
        <div style={{ position: 'relative', width: `${scaledWidthA}px`, height: `${scaledHeightA}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {pdfDocA && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocA}
              scale={scale}
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
            />
          )}
          <DiffHighlightOverlay
            boxes={diffsA}
            scale={scale}
            colorScheme="deletions"
            selectedDiffId={selectedDiffId}
            onSelectDiff={onSelectDiff}
          />
        </div>
      </div>

      {/* Panel B - Document B (Comparison) */}
      <div
        ref={containerBRef}
        style={{
          flex: 1,
          height: '100%',
          overflow: 'auto',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px'
        }}
      >
        <div style={{
          marginBottom: '8px', padding: '4px 12px', borderRadius: '4px',
          backgroundColor: '#0284c7', color: '#ffffff', fontSize: '11px', fontWeight: 600
        }}>
          Document B (Comparison) - Page {pageNum}
        </div>
        <div style={{ position: 'relative', width: `${scaledWidthB}px`, height: `${scaledHeightB}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {pdfDocB && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocB}
              scale={scale}
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
            />
          )}
          <DiffHighlightOverlay
            boxes={diffsB}
            scale={scale}
            colorScheme="additions"
            selectedDiffId={selectedDiffId}
            onSelectDiff={onSelectDiff}
          />
        </div>
      </div>
    </div>
  );
}
