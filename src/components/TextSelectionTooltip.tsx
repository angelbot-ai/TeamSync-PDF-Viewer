/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Floating quick-action copy pill rendered directly above active text selections.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboardUtils';

interface TextSelectionTooltipProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy?: (text: string) => void;
}

export const TextSelectionTooltip: React.FC<TextSelectionTooltipProps> = ({ containerRef, onCopy }) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.rangeCount || !containerRef.current) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;

    // Verify the selection is inside our viewer container
    if (!containerRef.current.contains(commonAncestor)) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const rangeRect = range.getBoundingClientRect();
    if (rangeRect.width === 0 && rangeRect.height === 0) {
      setPosition(null);
      setSelectedText('');
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = rangeRect.left + rangeRect.width / 2;
    const relLeft = centerX - containerRect.left + containerRef.current.scrollLeft;
    
    // Position 38px above selection by default; flip below if too close to container top
    let relTop = rangeRect.top - containerRect.top + containerRef.current.scrollTop - 38;
    if (relTop < containerRef.current.scrollTop + 8) {
      relTop = rangeRect.bottom - containerRect.top + containerRef.current.scrollTop + 8;
    }

    setSelectedText(text);
    setPosition({ top: relTop, left: relLeft });
  }, [containerRef]);

  useEffect(() => {
    const handleSelectionChange = () => {
      // Debounce slightly to let mouse-up complete selection bounding box
      requestAnimationFrame(updatePosition);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', updatePosition, { passive: true });
    }

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (container) {
        container.removeEventListener('scroll', updatePosition);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [containerRef, updatePosition]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedText) return;

    const success = await copyTextToClipboard(selectedText);
    if (success) {
      setCopied(true);
      onCopy?.(selectedText);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 1500);
    }
  };

  if (!position || !selectedText) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: '6px',
        padding: '3px 6px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        pointerEvents: 'auto',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        animation: 'tspdf-fade-in 0.15s ease-out'
      }}
      onMouseDown={(e) => {
        // Prevent clicking the tooltip from clearing the active DOM text selection
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <style>{`
        @keyframes tspdf-fade-in {
          from { opacity: 0; transform: translate(-50%, 4px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <button
        onClick={handleCopy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'transparent',
          border: 'none',
          color: copied ? '#4ade80' : '#f8fafc',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 500,
          padding: '3px 6px',
          borderRadius: '4px',
          transition: 'background-color 0.15s, color 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="Copy selected text"
      >
        {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} color="#f8fafc" />}
        <span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  );
};
export default TextSelectionTooltip;
