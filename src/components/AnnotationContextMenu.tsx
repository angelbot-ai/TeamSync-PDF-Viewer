/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { Copy, Trash2, Link as LinkIcon, Edit2 } from 'lucide-react';
import type { Annotation } from '../annotations/types';

import type { SDKPermissions } from '../core/types';

interface AnnotationContextMenuProps {
  annotation: Annotation;
  position: { top: number; left: number };
  onCopy: () => void;
  onDelete: () => void;
  onUpdateColor: (color: string) => void;
  onOpenLinkModal: () => void;
  permissions?: SDKPermissions;
}

export default function AnnotationContextMenu({
  annotation,
  position,
  onCopy,
  onDelete,
  onUpdateColor,
  onOpenLinkModal,
  permissions
}: AnnotationContextMenuProps) {
  const canAdd = permissions?.canAddAnnotations !== false;
  const canEdit = permissions?.canEditAnnotations !== false;
  const canDelete = permissions?.canDeleteAnnotations !== false;

  // Simple predefined colors for quick selection
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#000000'];

  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
        gap: '4px',
        zIndex: 2000,
        transform: 'translateY(8px)' // Slight offset below the element
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {canAdd && (
        <>
          <MenuButton icon={<Copy size={16} />} title="Duplicate" onClick={onCopy} />
          <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
        </>
      )}
      
      {canEdit && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 4px' }}>
            {COLORS.map(c => (
              <div
                key={c}
                onClick={() => onUpdateColor(c)}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  cursor: 'pointer',
                  border: annotation.color === c ? '2px solid #374151' : '1px solid transparent'
                }}
                title={`Set color ${c}`}
              />
            ))}
          </div>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
        </>
      )}

      {canEdit && (
        annotation.type === 'link' ? (
          <button
            title={annotation.linkUrl ? `Edit Link (${annotation.linkUrl})` : 'Edit Link'}
            onClick={onOpenLinkModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#eef2ff',
              cursor: 'pointer',
              color: '#4338ca',
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 500
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e7ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#eef2ff'}
          >
            <Edit2 size={14} />
            Edit Link
          </button>
        ) : (
          <MenuButton icon={<LinkIcon size={16} />} title="Link URL or Page" onClick={onOpenLinkModal} />
        )
      )}

      {canDelete && (
        <MenuButton icon={<Trash2 size={16} />} title="Delete" onClick={onDelete} color="#ef4444" />
      )}
    </div>
  );
}

function MenuButton({ icon, title, onClick, color = '#4b5563' }: { icon: React.ReactNode, title: string, onClick: () => void, color?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        color: color
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {icon}
    </button>
  );
}
