/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React, { useState } from 'react';
import type { DiffBoundingBox } from '../types/compare';

interface DiffHighlightOverlayProps {
  boxes: DiffBoundingBox[];
  scale: number;
  colorScheme?: 'deletions' | 'additions' | 'all';
  selectedDiffId?: string | null;
  onSelectDiff?: (id: string) => void;
}

export default function DiffHighlightOverlay({
  boxes,
  scale,
  colorScheme = 'all',
  selectedDiffId,
  onSelectDiff
}: DiffHighlightOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!boxes || boxes.length === 0) return null;

  const filteredBoxes = boxes.filter(b => {
    if (colorScheme === 'deletions') return b.type === 'deletion' || b.type === 'modification';
    if (colorScheme === 'additions') return b.type === 'addition' || b.type === 'modification';
    return true;
  });

  return (
    <div
      className="tspdf-diff-highlight-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15
      }}
    >
      <style>{`
        @keyframes tspdf-diff-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.8), 0 0 12px rgba(2, 132, 199, 0.5);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(2, 132, 199, 0.35), 0 0 24px rgba(2, 132, 199, 0.8);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.8), 0 0 12px rgba(2, 132, 199, 0.5);
          }
        }
      `}</style>
      {filteredBoxes.map((box) => {
        const isSelected = selectedDiffId === box.id;
        const isHovered = hoveredId === box.id;

        let bg = 'rgba(245, 158, 11, 0.22)';
        let border = '1.5px solid #f59e0b';
        let labelColor = '#d97706';
        let labelPrefix = 'Changed';

        if (box.type === 'deletion') {
          bg = isSelected ? 'rgba(225, 29, 72, 0.35)' : 'rgba(225, 29, 72, 0.22)';
          border = isSelected ? '2px solid #e11d48' : '1.5px solid #e11d48';
          labelColor = '#e11d48';
          labelPrefix = 'Removed';
        } else if (box.type === 'addition') {
          bg = isSelected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.22)';
          border = isSelected ? '2px solid #10b981' : '1.5px solid #10b981';
          labelColor = '#059669';
          labelPrefix = 'Added';
        }

        const x = box.x * scale;
        const y = box.y * scale;
        const w = box.width * scale;
        const h = box.height * scale;

        return (
          <div
            key={box.id}
            id={`diff-highlight-${box.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectDiff?.(box.id);
            }}
            onMouseEnter={() => setHoveredId(box.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              backgroundColor: bg,
              border: border,
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              animation: isSelected ? 'tspdf-diff-pulse 1.8s infinite ease-in-out' : 'none',
              boxShadow: isSelected
                ? '0 0 0 3px #0284c7, 0 4px 16px rgba(2, 132, 199, 0.5)'
                : isHovered
                ? '0 0 0 2px rgba(0,0,0,0.25)'
                : 'none',
              transition: 'all 0.15s ease-in-out',
              zIndex: isSelected ? 30 : isHovered ? 25 : 15
            }}
            title={`${labelPrefix}: ${box.text}`}
          >
            {(isHovered || isSelected) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '6px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  zIndex: 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ color: labelColor, fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
                  {labelPrefix}
                </span>
                <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  "{box.text}"
                </span>
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '5px solid #0f172a'
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

