/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React from 'react';
import { Layers, FileText, CheckCircle2, MinusCircle, PlusCircle, AlertCircle } from 'lucide-react';
import type { DiffItem, TextDiffSegment } from '../types/compare';

interface DiffSummarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  diffItems: DiffItem[];
  textDiffs: TextDiffSegment[];
  currentDiffIndex: number;
  onSelectDiff: (index: number, item?: DiffItem) => void;
  onJumpToPage: (pageIndex: number) => void;
}

export default function DiffSummarySidebar({
  isOpen,
  diffItems,
  textDiffs,
  currentDiffIndex,
  onSelectDiff,
  onJumpToPage
}: DiffSummarySidebarProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      width: '320px',
      height: '100%',
      backgroundColor: '#ffffff',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 80
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
          <Layers size={18} color="#0284c7" />
          <span>Compare Summary</span>
        </div>
        <span style={{
          fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
          backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600
        }}>
          {diffItems.length} Differences
        </span>
      </div>

      {/* List Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {diffItems.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={14} />
              <span>Differences on Page ({diffItems.length})</span>
            </div>

            {diffItems.map((item, idx) => {
              const isSelected = idx === currentDiffIndex;
              const isDel = item.type === 'deletion';
              const isAdd = item.type === 'addition';

              let badgeColor = isDel ? '#e11d48' : isAdd ? '#10b981' : '#f59e0b';
              let badgeBg = isDel ? '#ffe4e6' : isAdd ? '#dcfce7' : '#fef3c7';
              let badgeLabel = isDel ? 'Removed' : isAdd ? 'Added' : 'Changed';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectDiff(idx, item);
                    if (item.pageIndex) onJumpToPage(item.pageIndex);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    borderLeft: isSelected ? '4px solid #0284c7' : `3px solid ${badgeColor}`,
                    marginBottom: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.18)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isDel && <MinusCircle size={13} color="#e11d48" />}
                      {isAdd && <PlusCircle size={13} color="#10b981" />}
                      {!isDel && !isAdd && <AlertCircle size={13} color="#f59e0b" />}
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: badgeBg,
                        color: badgeColor
                      }}>
                        {badgeLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      Page {item.pageIndex}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: isSelected ? '#0369a1' : '#334155',
                    fontWeight: isSelected ? 600 : 400,
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}>
                    {item.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {textDiffs.length > 0 && diffItems.length === 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={14} />
              <span>Text Differences</span>
            </div>

            {textDiffs.filter(t => t.type !== 'equal').map((seg, i) => (
              <div
                key={`text-diff-${i}`}
                onClick={() => onJumpToPage(seg.pageIndex)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: seg.type === 'add' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${seg.type === 'add' ? '#bbf7d0' : '#fecaca'}`,
                  marginBottom: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                  <span>Page {seg.pageIndex}</span>
                  <span style={{ color: seg.type === 'add' ? '#16a34a' : '#dc2626', textTransform: 'uppercase' }}>
                    {seg.type === 'add' ? '+ Addition' : '- Deletion'}
                  </span>
                </div>
                <div style={{
                  color: seg.type === 'add' ? '#15803d' : '#b91c1c',
                  textDecoration: seg.type === 'delete' ? 'line-through' : 'none',
                  fontFamily: 'monospace',
                  wordBreak: 'break-word'
                }}>
                  {seg.text.length > 120 ? `${seg.text.substring(0, 120)}...` : seg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {diffItems.length === 0 && textDiffs.filter(t => t.type !== 'equal').length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
            <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>Documents Match</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>No visual or structural differences detected between the two PDF documents.</div>
          </div>
        )}
      </div>
    </div>
  );
}

