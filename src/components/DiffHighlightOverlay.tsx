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
      {filteredBoxes.map((box) => {
        const isSelected = selectedDiffId === box.id;
        const isHovered = hoveredId === box.id;

        let bg = 'rgba(245, 158, 11, 0.25)';
        let border = '1.5px solid #f59e0b';
        let labelColor = '#d97706';
        let labelPrefix = 'Changed';

        if (box.type === 'deletion') {
          bg = 'rgba(225, 29, 72, 0.25)';
          border = '1.5px solid #e11d48';
          labelColor = '#e11d48';
          labelPrefix = 'Removed';
        } else if (box.type === 'addition') {
          bg = 'rgba(16, 185, 129, 0.25)';
          border = '1.5px solid #10b981';
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
              borderRadius: '3px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              boxShadow: isSelected
                ? '0 0 0 3px #0284c7, 0 4px 12px rgba(2, 132, 199, 0.35)'
                : isHovered
                ? '0 0 0 2px rgba(0,0,0,0.3)'
                : 'none',
              transition: 'box-shadow 0.15s ease-in-out',
              zIndex: isSelected ? 25 : isHovered ? 20 : 15
            }}
            title={`${labelPrefix}: ${box.text}`}
          >
            {(isHovered || isSelected) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '4px',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ color: labelColor, fontWeight: 700 }}>{labelPrefix}:</span>
                <span>{box.text.length > 50 ? box.text.slice(0, 50) + '...' : box.text}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
