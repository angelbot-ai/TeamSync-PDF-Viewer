/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  parseCommandString,
  matchShortcut,
  loadStoredShortcuts,
  DEFAULT_SHORTCUTS
} from './useShortcuts';

describe('useShortcuts', () => {
  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
    removeItem: (k: string) => { storageMap.delete(k); },
    clear: () => { storageMap.clear(); },
    get length() { return storageMap.size; },
    key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  };

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('parseCommandString', () => {
    it('parses single modifier and key', () => {
      const parsed = parseCommandString('Meta+F');
      expect(parsed).toEqual({ meta: true, shift: false, alt: false, key: 'f' });
    });

    it('parses multiple modifiers and key', () => {
      const parsed = parseCommandString('Meta+Shift+Z');
      expect(parsed).toEqual({ meta: true, shift: true, alt: false, key: 'z' });
    });

    it('parses Alt/Option modifier', () => {
      const parsed = parseCommandString('Alt+Shift+T');
      expect(parsed).toEqual({ meta: false, shift: true, alt: true, key: 't' });
    });

    it('handles symbols like = and -', () => {
      const cw = parseCommandString('Meta+Shift+=');
      expect(cw).toEqual({ meta: true, shift: true, alt: false, key: '=' });

      const ccw = parseCommandString('Meta+Shift+-');
      expect(ccw).toEqual({ meta: true, shift: true, alt: false, key: '-' });
    });

    it('handles plus sign safely', () => {
      const plusOnly = parseCommandString('Meta++');
      expect(plusOnly).toEqual({ meta: true, shift: false, alt: false, key: '+' });
    });

    it('handles empty or blank string gracefully', () => {
      expect(parseCommandString('')).toEqual({ meta: false, shift: false, alt: false, key: '' });
    });
  });

  describe('matchShortcut', () => {
    it('matches Meta+F with metaKey or ctrlKey', () => {
      const macEvent = new KeyboardEvent('keydown', { key: 'f', metaKey: true });
      expect(matchShortcut(macEvent, 'Meta+F')).toBe(true);

      const winEvent = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true });
      expect(matchShortcut(winEvent, 'Meta+F')).toBe(true);

      const noMetaEvent = new KeyboardEvent('keydown', { key: 'f' });
      expect(matchShortcut(noMetaEvent, 'Meta+F')).toBe(false);
    });

    it('matches Delete and Backspace interchangeably for Delete shortcut', () => {
      const delEvent = new KeyboardEvent('keydown', { key: 'Delete' });
      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' });
      const otherEvent = new KeyboardEvent('keydown', { key: 'Escape' });

      expect(matchShortcut(delEvent, 'Delete')).toBe(true);
      expect(matchShortcut(backspaceEvent, 'Delete')).toBe(true);
      expect(matchShortcut(otherEvent, 'Delete')).toBe(false);
    });

    it('matches Rotate CW (Meta+Shift+=) with physical Shift+= event on US layout', () => {
      // On US keyboards, Shift+= generates key='+', code='Equal', shiftKey=true
      const shiftEqualEvent = new KeyboardEvent('keydown', {
        key: '+',
        code: 'Equal',
        metaKey: true,
        shiftKey: true
      });
      expect(matchShortcut(shiftEqualEvent, 'Meta+Shift+=')).toBe(true);

      // Should not match if Shift is omitted (e.g. Meta+= zoom shortcut)
      const zoomInEvent = new KeyboardEvent('keydown', {
        key: '=',
        code: 'Equal',
        metaKey: true,
        shiftKey: false
      });
      expect(matchShortcut(zoomInEvent, 'Meta+Shift+=')).toBe(false);
    });

    it('matches Rotate CCW (Meta+Shift+-) with physical Shift+- event on US layout', () => {
      // On US keyboards, Shift+- generates key='_', code='Minus', shiftKey=true
      const shiftMinusEvent = new KeyboardEvent('keydown', {
        key: '_',
        code: 'Minus',
        metaKey: true,
        shiftKey: true
      });
      expect(matchShortcut(shiftMinusEvent, 'Meta+Shift+-')).toBe(true);

      // Should not match if Shift is omitted (e.g. Meta+- zoom out shortcut)
      const zoomOutEvent = new KeyboardEvent('keydown', {
        key: '-',
        code: 'Minus',
        metaKey: true,
        shiftKey: false
      });
      expect(matchShortcut(zoomOutEvent, 'Meta+Shift+-')).toBe(false);
    });

    it('requires shiftKey when command includes Shift', () => {
      const redoWithShift = new KeyboardEvent('keydown', {
        key: 'z',
        code: 'KeyZ',
        metaKey: true,
        shiftKey: true
      });
      const undoWithoutShift = new KeyboardEvent('keydown', {
        key: 'z',
        code: 'KeyZ',
        metaKey: true,
        shiftKey: false
      });

      expect(matchShortcut(redoWithShift, 'Meta+Shift+Z')).toBe(true);
      expect(matchShortcut(undoWithoutShift, 'Meta+Shift+Z')).toBe(false);
      expect(matchShortcut(undoWithoutShift, 'Meta+Z')).toBe(true);
    });
  });

  describe('loadStoredShortcuts', () => {
    it('returns default shortcuts when storage is empty', () => {
      const loaded = loadStoredShortcuts();
      expect(loaded).toEqual(DEFAULT_SHORTCUTS);
    });

    it('loads and merges customized shortcuts from localStorage', () => {
      const custom = DEFAULT_SHORTCUTS.map(s =>
        s.action === 'SEARCH' ? { ...s, command: 'Meta+K' } : s
      );
      mockLocalStorage.setItem('pdfviewer_shortcuts', JSON.stringify(custom));

      const loaded = loadStoredShortcuts();
      const searchItem = loaded.find(s => s.action === 'SEARCH');
      expect(searchItem?.command).toBe('Meta+K');
    });

    it('recovers gracefully from corrupted localStorage', () => {
      mockLocalStorage.setItem('pdfviewer_shortcuts', 'invalid-json-data');
      const loaded = loadStoredShortcuts();
      expect(loaded).toEqual(DEFAULT_SHORTCUTS);
    });
  });
});
