/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { Hand, MessageSquare, Type, ZoomIn, ZoomOut, Link as LinkIcon, Highlighter, Underline as UnderlineIcon, Copy, Strikethrough } from 'lucide-react';

interface PageContextMenuProps {
  position: { top: number; left: number };
  hasSelection?: boolean;
  onSetTool: (tool: any) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onClose: () => void;
  onLink?: () => void;
  onHighlight?: () => void;
  onUnderline?: () => void;
  onStrikethrough?: () => void;
  onCopy?: () => void;
  enableAnnotations?: boolean;
}

export default function PageContextMenu({
  position,
  hasSelection,
  onSetTool,
  onZoomIn,
  onZoomOut,
  onClose,
  onLink,
  onHighlight,
  onUnderline,
  onStrikethrough,
  onCopy,
  enableAnnotations
}: PageContextMenuProps) {
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        padding: '4px',
        minWidth: '150px',
        zIndex: 2000,
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {hasSelection ? (
        <>
          {enableAnnotations !== false && (
            <>
              <MenuOption icon={<Highlighter size={16} />} label="Highlight" onClick={() => { onHighlight?.(); onClose(); }} />
              <MenuOption icon={<UnderlineIcon size={16} />} label="Underline" onClick={() => { onUnderline?.(); onClose(); }} />
              <MenuOption icon={<Strikethrough size={16} />} label="Strikethrough" onClick={() => { onStrikethrough?.(); onClose(); }} />
              <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
            </>
          )}
          <MenuOption icon={<Copy size={16} />} label="Copy Text" onClick={() => { onCopy?.(); onClose(); }} />
          {enableAnnotations !== false && (
            <>
              <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
              <MenuOption icon={<LinkIcon size={16} />} label="Create Link" onClick={() => { onLink?.(); onClose(); }} />
            </>
          )}
        </>
      ) : (
        <>
          <MenuOption icon={<Hand size={16} />} label="Pan Tool" onClick={() => { onSetTool('pan'); onClose(); }} />
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
          {enableAnnotations !== false && (
            <>
              <MenuOption icon={<MessageSquare size={16} />} label="Add Note" onClick={() => { onSetTool('note'); onClose(); }} />
              <MenuOption icon={<Type size={16} />} label="Add Text" onClick={() => { onSetTool('text'); onClose(); }} />
              <MenuOption icon={<LinkIcon size={16} />} label="Add Link" onClick={() => { onLink?.(); onClose(); }} />
              <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
            </>
          )}
          <MenuOption icon={<ZoomIn size={16} />} label="Zoom In" onClick={() => { onZoomIn(); onClose(); }} />
          <MenuOption icon={<ZoomOut size={16} />} label="Zoom Out" onClick={() => { onZoomOut(); onClose(); }} />
        </>
      )}
    </div>
  );
}

function MenuOption({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        color: '#374151',
        fontSize: '14px',
        textAlign: 'left',
        borderRadius: '4px',
        gap: '8px'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
