import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from './clipboardUtils';

describe('clipboardUtils', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('returns false when empty text is provided', async () => {
    const result = await copyTextToClipboard('');
    expect(result).toBe(false);
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: writeTextMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const result = await copyTextToClipboard('Hello TeamSync');
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Hello TeamSync');
  });

  it('falls back to document.execCommand when navigator.clipboard fails', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: writeTextMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const result = await copyTextToClipboard('Fallback Text');
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });
});
