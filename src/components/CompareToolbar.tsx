/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React from 'react';
import { Layers, Columns, FileText, SlidersHorizontal, ChevronLeft, ChevronRight, X, MinusCircle, PlusCircle, Maximize2, Hand, MousePointer } from 'lucide-react';
import type { CompareMode, CompareState } from '../types/compare';

interface CompareToolbarProps {
  compareState: CompareState;
  onSetMode: (mode: CompareMode) => void;
  onSetColors: (colorA: string, colorB: string) => void;
  onToggleCurtain: () => void;
  onPrevDiff: () => void;
  onNextDiff: () => void;
  onExit: () => void;
  is90Fit?: boolean;
  zoomMultiplier?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit90?: () => void;
  activeTool?: string | null;
  onSetTool?: (tool: string | null) => void;
}

export default function CompareToolbar({
  compareState,
  onSetMode,
  onSetColors,
  onToggleCurtain,
  onPrevDiff,
  onNextDiff,
  onExit,
  is90Fit = true,
  zoomMultiplier = 1.0,
  onZoomIn,
  onZoomOut,
  onFit90,
  activeTool,
  onSetTool
}: CompareToolbarProps) {
  const { mode, colorA, colorB, showCurtain, diffItems, currentDiffIndex } = compareState;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '6px 16px',
      backgroundColor: '#1e293b',
      color: '#f8fafc',
      borderBottom: '1px solid #334155',
      height: '42px',
      fontSize: '13px',
      zIndex: 100,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }}>
      {/* Compare Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#38bdf8' }}>
        <Layers size={16} />
        <span>Document Compare</span>
      </div>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#475569' }} />

      {/* Mode Switcher */}
      <div style={{ display: 'flex', backgroundColor: '#0f172a', borderRadius: '6px', padding: '2px' }}>
        <button
          onClick={() => onSetMode('overlay')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '4px', border: 'none',
            backgroundColor: mode === 'overlay' ? '#0284c7' : 'transparent',
            color: mode === 'overlay' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer', fontSize: '12px', fontWeight: 500
          }}
          title="Overlay Color Blend Diff"
        >
          <Layers size={14} />
          <span>Overlay Diff</span>
        </button>

        <button
          onClick={() => onSetMode('side-by-side')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '4px', border: 'none',
            backgroundColor: mode === 'side-by-side' ? '#0284c7' : 'transparent',
            color: mode === 'side-by-side' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer', fontSize: '12px', fontWeight: 500
          }}
          title="Side-by-Side Synchronized MultiViewer"
        >
          <Columns size={14} />
          <span>Side-by-Side</span>
        </button>

        <button
          onClick={() => onSetMode('semantic')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '4px', border: 'none',
            backgroundColor: mode === 'semantic' ? '#0284c7' : 'transparent',
            color: mode === 'semantic' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer', fontSize: '12px', fontWeight: 500
          }}
          title="Semantic Text & Structured Diff"
        >
          <FileText size={14} />
          <span>Text Diff</span>
        </button>
      </div>

      {/* Mode Specific Controls */}
      {mode === 'overlay' && (
        <>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569' }} />
          
          {/* Color Tint Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Doc A:</span>
              <input
                type="color"
                value={colorA}
                onChange={(e) => onSetColors(e.target.value, colorB)}
                style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                title="Document A Tint Color (Deletions)"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Doc B:</span>
              <input
                type="color"
                value={colorB}
                onChange={(e) => onSetColors(colorA, e.target.value)}
                style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                title="Document B Tint Color (Additions)"
              />
            </div>
          </div>

          <button
            onClick={onToggleCurtain}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', borderRadius: '4px', border: '1px solid #475569',
              backgroundColor: showCurtain ? '#0369a1' : 'transparent',
              color: '#f8fafc', cursor: 'pointer', fontSize: '12px'
            }}
            title="Toggle Wipe Curtain Slider"
          >
            <SlidersHorizontal size={14} />
            <span>Curtain Slider</span>
          </button>
        </>
      )}

      {/* Zoom & View Controls */}
      {onZoomIn && onZoomOut && (
        <>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0f172a', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={onZoomOut}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '4px', border: 'none',
                backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer'
              }}
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <MinusCircle size={15} />
            </button>

            <button
              onClick={onFit90}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', height: '26px', borderRadius: '4px', border: 'none',
                backgroundColor: (is90Fit && zoomMultiplier === 1.0) ? '#0284c7' : 'transparent',
                color: (is90Fit && zoomMultiplier === 1.0) ? '#ffffff' : '#cbd5e1',
                cursor: 'pointer', fontSize: '11px', fontWeight: 600
              }}
              title="Reset both documents to 90% window fit"
              aria-label="Fit to 90% Window"
            >
              <Maximize2 size={13} />
              <span>{is90Fit && zoomMultiplier === 1.0 ? '90% Fit' : `${Math.round(zoomMultiplier * 100)}%`}</span>
            </button>

            <button
              onClick={onZoomIn}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '4px', border: 'none',
                backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer'
              }}
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <PlusCircle size={15} />
            </button>
          </div>
        </>
      )}

      {/* Navigation & Pan Controls */}
      {onSetTool && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#0f172a', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => onSetTool('select')}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', height: '26px', borderRadius: '4px', border: 'none',
                backgroundColor: activeTool !== 'pan' ? '#0284c7' : 'transparent',
                color: activeTool !== 'pan' ? '#ffffff' : '#94a3b8',
                cursor: 'pointer', fontSize: '11px', fontWeight: 500
              }}
              title="Select / Pointer Tool"
              aria-label="Select Tool"
            >
              <MousePointer size={13} />
              <span>Select</span>
            </button>

            <button
              onClick={() => onSetTool(activeTool === 'pan' ? 'select' : 'pan')}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', height: '26px', borderRadius: '4px', border: 'none',
                backgroundColor: activeTool === 'pan' ? '#0284c7' : 'transparent',
                color: activeTool === 'pan' ? '#ffffff' : '#94a3b8',
                cursor: 'pointer', fontSize: '11px', fontWeight: 500
              }}
              title="Pan Tool (Hand) — Click and drag to pan both documents"
              aria-label="Pan Tool"
            >
              <Hand size={13} />
              <span>Pan</span>
            </button>
          </div>
        </>
      )}

      {/* Diff Navigation Counter */}
      {diffItems.length > 0 && (
        <>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#475569' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onPrevDiff}
              style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#f8fafc', cursor: 'pointer' }}
              title="Previous Difference"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: '12px', color: '#cbd5e1', minWidth: '70px', textAlign: 'center' }}>
              {currentDiffIndex + 1} of {diffItems.length} diffs
            </span>
            <button
              onClick={onNextDiff}
              style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#f8fafc', cursor: 'pointer' }}
              title="Next Difference"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Exit Compare Button */}
      <button
        onClick={onExit}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '4px 10px', borderRadius: '4px', border: 'none',
          backgroundColor: '#dc2626', color: '#ffffff',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600
        }}
        title="Exit Compare Mode"
      >
        <X size={14} />
        <span>Exit Compare</span>
      </button>
    </div>
  );
}
