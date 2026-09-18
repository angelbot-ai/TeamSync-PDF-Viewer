/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '6.2.108',
  getDocument: vi.fn(),
}));

import SideBySideViewer from './SideBySideViewer';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('SideBySideViewer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders dual panels, page labels, and draggable separator', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SideBySideViewer
          pdfDocA={null}
          pdfDocB={null}
          pageNum={1}
          scale={1}
          rotation={0}
          basePageDims={{ width: 612, height: 792 }}
          activeTab="View"
          activeTool={null}
          annotations={[]}
          is90Fit={true}
          zoomMultiplier={1.0}
        />
      );
    });

    expect(container.textContent).toContain('Document A (Base) - Page 1');
    expect(container.textContent).toContain('Document B (Comparison) - Page 1');

    // Separator element
    const separator = container.querySelector('div[title*="Drag to resize panels"]');
    expect(separator).not.toBeNull();

    // Double clicking separator triggers reset to 50%
    await act(async () => {
      separator?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('activates pan cursor and panning mode when activeTool is pan', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SideBySideViewer
          pdfDocA={null}
          pdfDocB={null}
          pageNum={1}
          scale={1}
          rotation={0}
          basePageDims={{ width: 612, height: 792 }}
          activeTab="View"
          activeTool="pan"
          annotations={[]}
          is90Fit={true}
          zoomMultiplier={1.0}
        />
      );
    });

    const panels = container.querySelectorAll('div[style*="overflow: auto"]');
    expect(panels.length).toBe(2);

    // Initial cursor is grab
    expect((panels[0] as HTMLElement).style.cursor).toBe('grab');
    expect((panels[1] as HTMLElement).style.cursor).toBe('grab');

    // Mouse down starts panning
    await act(async () => {
      panels[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    });

    // Cursor becomes grabbing
    expect((panels[0] as HTMLElement).style.cursor).toBe('grabbing');

    // Mouse up ends panning
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect((panels[0] as HTMLElement).style.cursor).toBe('grab');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onZoomIn and onZoomOut when Ctrl/Cmd+Wheel is triggered', async () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SideBySideViewer
          pdfDocA={null}
          pdfDocB={null}
          pageNum={1}
          scale={1}
          rotation={0}
          basePageDims={{ width: 612, height: 792 }}
          activeTab="View"
          activeTool={null}
          annotations={[]}
          is90Fit={true}
          zoomMultiplier={1.0}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />
      );
    });

    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();

    // Wheel with ctrlKey zooms in
    await act(async () => {
      wrapper?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: -100 }));
    });
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    // Wheel with ctrlKey zooms out
    await act(async () => {
      wrapper?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, ctrlKey: true, deltaY: 100 }));
    });
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
