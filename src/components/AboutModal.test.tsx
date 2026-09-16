/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AboutModal from './AboutModal';
import { VERSION } from '../version';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('AboutModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders with default VERSION and release notes link', async () => {
    // Mock fetch to reject so it stays on default VERSION
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AboutModal onClose={onClose} />);
    });

    expect(container.textContent).toContain(`Version ${VERSION}`);
    expect(container.textContent).toContain('Release Notes');

    const releaseLink = container.querySelector(`a[href*="releases/tag/v${VERSION}"]`);
    expect(releaseLink).not.toBeNull();
    expect(releaseLink?.getAttribute('target')).toBe('_blank');

    await act(async () => {
      root.unmount();
    });
  });

  it('fetches and displays updated version from /api/version', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === '/api/version') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            version: '2.0.0',
            releaseUrl: 'https://github.com/angelbot-ai/TeamSync-PDF-Viewer/releases/tag/v2.0.0',
          }),
        } as Response);
      }
      return Promise.reject(new Error('Not found'));
    });

    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AboutModal onClose={onClose} />);
    });

    expect(container.textContent).toContain('Version 2.0.0');
    const releaseLink = container.querySelector('a[href="https://github.com/angelbot-ai/TeamSync-PDF-Viewer/releases/tag/v2.0.0"]');
    expect(releaseLink).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onClose when close buttons are clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AboutModal onClose={onClose} />);
    });

    const closeButtons = container.querySelectorAll('button');
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);

    // Click header close button
    await act(async () => {
      closeButtons[0].click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click footer close button
    await act(async () => {
      closeButtons[1].click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });
});
