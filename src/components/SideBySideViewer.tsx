/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React, { useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PageRenderer from './PageRenderer';
import type { SDKPermissions, WatermarkOptions, Redaction } from '../core/types';

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
  redactions
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

  const scaledWidth = basePageDims.width * scale;
  const scaledHeight = basePageDims.height * scale;

  return (
    <div style={{ flex: 1, display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
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
        <div style={{ position: 'relative', width: `${scaledWidth}px`, height: `${scaledHeight}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {pdfDocA && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocA}
              scale={scale}
              rotation={rotation}
              scrollTop={0}
              scrollLeft={0}
              pageTop={0}
              basePageWidth={basePageDims.width}
              basePageHeight={basePageDims.height}
              containerWidth={scaledWidth}
              containerHeight={scaledHeight}
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
        <div style={{ position: 'relative', width: `${scaledWidth}px`, height: `${scaledHeight}px`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {pdfDocB && (
            <PageRenderer
              pageNum={pageNum}
              pdfDoc={pdfDocB}
              scale={scale}
              rotation={rotation}
              scrollTop={0}
              scrollLeft={0}
              pageTop={0}
              basePageWidth={basePageDims.width}
              basePageHeight={basePageDims.height}
              containerWidth={scaledWidth}
              containerHeight={scaledHeight}
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
        </div>
      </div>
    </div>
  );
}
