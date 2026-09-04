/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { useState, useEffect, useCallback } from 'react';

export type ActionType =
  | 'ROTATE_CW'
  | 'ROTATE_CCW'
  | 'UNDO'
  | 'REDO'
  | 'DELETE'
  | 'COPY'
  | 'PASTE'
  | 'FILE_PICKER'
  | 'SEARCH';

export interface Shortcut {
  action: ActionType;
  description: string;
  defaultCommand: string;
  command: string;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
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

const STORAGE_KEY = 'pdfviewer_shortcuts';
const CHANGE_EVENT = 'pdfviewer-shortcuts-changed';

let cachedShortcuts: Shortcut[] | null = null;
const listeners = new Set<() => void>();

export function loadStoredShortcuts(): Shortcut[] {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SHORTCUTS;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return DEFAULT_SHORTCUTS.map(def => {
          const found = parsed.find((p: Shortcut) => p && p.action === def.action);
          return found && typeof found.command === 'string' ? { ...def, command: found.command } : def;
        });
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_SHORTCUTS;
}

function notifySubscribers() {
  listeners.forEach(fn => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    if (!cachedShortcuts) cachedShortcuts = loadStoredShortcuts();
    return cachedShortcuts;
  });

  useEffect(() => {
    const sync = () => {
      cachedShortcuts = loadStoredShortcuts();
      setShortcuts(cachedShortcuts);
    };

    listeners.add(sync);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', sync);
      window.addEventListener(CHANGE_EVENT, sync);
    }

    return () => {
      listeners.delete(sync);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', sync);
        window.removeEventListener(CHANGE_EVENT, sync);
      }
    };
  }, []);

  const updateShortcut = useCallback((action: ActionType, newCommand: string) => {
    const base = cachedShortcuts || loadStoredShortcuts();
    const updated = base.map(s => s.action === action ? { ...s, command: newCommand } : s);
    cachedShortcuts = updated;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    setShortcuts(updated);
    notifySubscribers();
  }, []);

  const resetShortcuts = useCallback(() => {
    cachedShortcuts = DEFAULT_SHORTCUTS;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setShortcuts(DEFAULT_SHORTCUTS);
    notifySubscribers();
  }, []);

  const getCommand = useCallback((action: ActionType): string => {
    const list = cachedShortcuts || shortcuts;
    const s = list.find(item => item.action === action);
    return s ? s.command : '';
  }, [shortcuts]);

  return { shortcuts, updateShortcut, resetShortcuts, getCommand };
}

export interface ParsedCommand {
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

export function parseCommandString(commandString: string): ParsedCommand {
  if (!commandString) return { meta: false, shift: false, alt: false, key: '' };

  const rawTokens = commandString.split('+');
  let meta = false;
  let shift = false;
  let alt = false;
  const keyTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const raw = rawTokens[i].trim();
    const lower = raw.toLowerCase();

    if (lower === 'meta' || lower === 'cmd' || lower === 'ctrl' || lower === 'command' || lower === 'control') {
      meta = true;
    } else if (lower === 'shift') {
      shift = true;
    } else if (lower === 'alt' || lower === 'option') {
      alt = true;
    } else if (raw === '' && i > 0 && rawTokens[i - 1] === '') {
      // Handles '+' key when split by '+' e.g. "Meta++" or "Meta+Shift++"
      keyTokens.push('+');
    } else if (raw !== '') {
      keyTokens.push(raw);
    }
  }

  if (commandString.endsWith('+') && keyTokens.length === 0) {
    keyTokens.push('+');
  }

  return { meta, shift, alt, key: keyTokens.join('+').toLowerCase() };
}

// Utility to match KeyboardEvent against a command string
export function matchShortcut(e: KeyboardEvent, commandString: string): boolean {
  if (!commandString) return false;
  const parsed = parseCommandString(commandString);

  const isMetaPressed = Boolean(e.metaKey || e.ctrlKey);
  if (parsed.meta !== isMetaPressed) return false;
  if (parsed.alt !== Boolean(e.altKey)) return false;

  const eventKey = (e.key || '').toLowerCase();
  const targetKey = parsed.key.toLowerCase();

  // Delete & Backspace mapping (interchangeable for DELETE action)
  if (targetKey === 'delete' || targetKey === 'backspace') {
    if (parsed.shift !== Boolean(e.shiftKey)) return false;
    return eventKey === 'delete' || eventKey === 'backspace';
  }

  // Plus & Equals: on US layout '+' is Shift+'='
  if (targetKey === '=' || targetKey === '+') {
    const isKeyEqualOrPlus = eventKey === '=' || eventKey === '+' || e.code === 'Equal' || e.code === 'NumpadAdd';
    if (!isKeyEqualOrPlus) return false;
    if (parsed.shift && !e.shiftKey) return false;
    if (!parsed.shift && targetKey === '=' && e.shiftKey) return false;
    return true;
  }

  // Minus & Underscore: on US layout '_' is Shift+'-'
  if (targetKey === '-' || targetKey === '_') {
    const isKeyMinus = eventKey === '-' || eventKey === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract';
    if (!isKeyMinus) return false;
    if (parsed.shift && !e.shiftKey) return false;
    if (!parsed.shift && targetKey === '-' && e.shiftKey) return false;
    return true;
  }

  // Check shift requirement
  if (parsed.shift !== Boolean(e.shiftKey)) return false;

  // Direct key or code match
  if (eventKey === targetKey) return true;
  if (e.code && e.code.toLowerCase() === `key${targetKey}`) return true;
  if (e.code && e.code.toLowerCase() === `digit${targetKey}`) return true;

  return false;
}
