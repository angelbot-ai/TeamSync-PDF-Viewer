/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { useState, useEffect } from 'react';

export type ActionType = 'ROTATE_CW' | 'ROTATE_CCW' | 'UNDO' | 'REDO' | 'DELETE' | 'COPY' | 'PASTE' | 'FILE_PICKER' | 'SEARCH';

export interface Shortcut {
  action: ActionType;
  description: string;
  defaultCommand: string;
  command: string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { action: 'ROTATE_CW', description: 'Rotate the document clockwise', defaultCommand: 'Meta+Shift+=', command: 'Meta+Shift+=' },
  { action: 'ROTATE_CCW', description: 'Rotate the document counterclockwise', defaultCommand: 'Meta+Shift+-', command: 'Meta+Shift+-' },
  { action: 'COPY', description: 'Copy selected text or annotations', defaultCommand: 'Meta+C', command: 'Meta+C' },
  { action: 'PASTE', description: 'Paste text or annotations', defaultCommand: 'Meta+V', command: 'Meta+V' },
  { action: 'UNDO', description: 'Undo an annotation change', defaultCommand: 'Meta+Z', command: 'Meta+Z' },
  { action: 'REDO', description: 'Redo an annotation change', defaultCommand: 'Meta+Shift+Z', command: 'Meta+Shift+Z' },
  { action: 'FILE_PICKER', description: 'Open the file picker', defaultCommand: 'Meta+O', command: 'Meta+O' },
  { action: 'SEARCH', description: 'Open the search overlay', defaultCommand: 'Meta+F', command: 'Meta+F' },
  { action: 'DELETE', description: 'Delete selected annotation', defaultCommand: 'Delete', command: 'Delete' },
];

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pdfviewer_shortcuts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new actions are included
        const merged = DEFAULT_SHORTCUTS.map(def => {
          const found = parsed.find((p: Shortcut) => p.action === def.action);
          return found ? { ...def, command: found.command } : def;
        });
        setShortcuts(merged);
      } catch {
        setShortcuts(DEFAULT_SHORTCUTS);
      }
    } else {
      setShortcuts(DEFAULT_SHORTCUTS);
    }
  }, []);

  const updateShortcut = (action: ActionType, newCommand: string) => {
    const updated = shortcuts.map(s => s.action === action ? { ...s, command: newCommand } : s);
    setShortcuts(updated);
    localStorage.setItem('pdfviewer_shortcuts', JSON.stringify(updated));
  };

  const getCommand = (action: ActionType) => {
    const s = shortcuts.find(s => s.action === action);
    return s ? s.command : '';
  };

  return { shortcuts, updateShortcut, getCommand };
}

// Utility to match KeyboardEvent against a command string
export function matchShortcut(e: KeyboardEvent, commandString: string): boolean {
  if (!commandString) return false;
  
  const parts = commandString.toLowerCase().split('+');
  const needsMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');
  
  const isMetaPressed = e.metaKey || e.ctrlKey;
  
  if (needsMeta !== isMetaPressed) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  const key = parts[parts.length - 1];
  
  // Special keys mapping
  if (key === 'delete' && (e.key === 'Delete' || e.key === 'Backspace')) return true;
  if (e.key.toLowerCase() === key) return true;
  
  return false;
}
