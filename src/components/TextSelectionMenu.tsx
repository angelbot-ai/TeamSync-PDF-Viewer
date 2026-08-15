/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { Highlighter, Type, Copy, Link as LinkIcon, EyeOff } from 'lucide-react';

import type { SDKPermissions } from '../main';

interface TextSelectionMenuProps {
  position: { top: number; left: number };
  onHighlight: () => void;
  onText?: () => void;
  onRedact?: () => void;
  onCopy?: () => void;
  onLink?: () => void;
  permissions?: SDKPermissions;
  isViewMode?: boolean;
  hasText?: boolean;
}

export default function TextSelectionMenu({
  position,
  onHighlight,
  onText,
  onRedact,
  onCopy,
  onLink,
  permissions,
  isViewMode = false,
  hasText = true
}: TextSelectionMenuProps) {
  const canAdd = !isViewMode && permissions?.canAddAnnotations !== false;
  const canRedact = !isViewMode && permissions?.canRedact !== false;

  if (isViewMode && !hasText) return null;

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
        transform: 'translate(-50%, -100%) translateY(-8px)'
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {canAdd && (
        <>
          <MenuButton icon={<Highlighter size={16} />} title="Highlight" onClick={onHighlight} />
          {onText && <MenuButton icon={<Type size={16} />} title="Add Text" onClick={onText} />}
        </>
      )}
      {canRedact && onRedact && (
        <MenuButton icon={<EyeOff size={16} />} title="Redact" onClick={onRedact} color="#dc2626" />
      )}
      {hasText && onCopy && (
        <>
          {(canAdd || canRedact) && (
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
          )}
          <MenuButton icon={<Copy size={16} />} title="Copy Text" onClick={onCopy} />
        </>
      )}
      {canAdd && onLink && (
        <>
          <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
          <MenuButton icon={<LinkIcon size={16} />} title="Create Link" onClick={onLink} />
        </>
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
