/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('pdfjs-dist', () => {
  const mockRenderTask = {
    promise: Promise.resolve(),
    cancel: vi.fn(),
  };

  const mockPage = {
    getViewport: vi.fn(({ scale }) => ({
      width: 612 * scale,
      height: 792 * scale,
      scale,
    })),
    render: vi.fn(() => mockRenderTask),
    getTextContent: vi.fn(() => Promise.resolve({ items: [] })),
    getAnnotations: vi.fn(() => Promise.resolve([])),
    cleanup: vi.fn(),
    rotate: 0,
  };

  const mockDoc = {
    numPages: 5,
    getPage: vi.fn(() => Promise.resolve(mockPage)),
    getFieldObjects: vi.fn(() => Promise.resolve(null)),
    cleanup: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    getDocument: vi.fn(() => ({
      promise: Promise.resolve(mockDoc),
      destroy: vi.fn(),
    })),
    TextLayer: vi.fn().mockImplementation(function (this: any) {
      this.render = vi.fn(() => Promise.resolve());
      this.cancel = vi.fn();
    }),
    GlobalWorkerOptions: { workerSrc: '' },
    PDFWorker: vi.fn().mockImplementation(() => ({
      destroy: vi.fn(),
      destroyed: false,
    })),
  };
});

import * as pdfjsLib from 'pdfjs-dist';
import PageRenderer from './PageRenderer';

describe('PageRenderer Sharpness & High-DPI Rendering', () => {
  let container: HTMLDivElement;
  let getContextSpy: any;
  let contextOptionsPassed: any[] = [];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    contextOptionsPassed = [];

    const mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    };

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: any
    ) {
      if (contextId === '2d') {
        contextOptionsPassed.push(options);
        return mockCtx as unknown as CanvasRenderingContext2D;
      }
      return null;
    });
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('requests { alpha: false } on canvas 2D contexts for subpixel LCD text antialiasing', async () => {
    const root = createRoot(container);
    const doc = await pdfjsLib.getDocument({ url: 'test.pdf' }).promise;

    await act(async () => {
      root.render(
        <PageRenderer
          pageNum={1}
          pdfDoc={doc}
          scale={1}
          rotation={0}
          basePageWidth={612}
          basePageHeight={792}
          annotations={[]}
          onAnnotationsChange={vi.fn()}
          readOnly={false}
          isInViewport={true}
          pageTop={0}
          pageLeft={0}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Check that context requests with { alpha: false } were made for both offscreen & dest canvases
    const opaqueCalls = contextOptionsPassed.filter((opt) => opt && opt.alpha === false);
    expect(opaqueCalls.length).toBeGreaterThanOrEqual(1);

    const canvasEl = container.querySelector('canvas');
    expect(canvasEl).toBeTruthy();
    expect(canvasEl?.style.imageRendering).toBe('auto');

    root.unmount();
  });

  it('renders canvas with at least 1.5x supersampling on 1x displays for crisp text', async () => {
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1.0, configurable: true, writable: true });

    const root = createRoot(container);
    const doc = await pdfjsLib.getDocument({ url: 'test.pdf' }).promise;
    const page = await doc.getPage(1);
    vi.mocked(page.render).mockClear();

    try {
      await act(async () => {
        root.render(
          <PageRenderer
            pageNum={1}
            pdfDoc={doc}
            scale={1}
            rotation={0}
            basePageWidth={612}
            basePageHeight={792}
            annotations={[]}
            onAnnotationsChange={vi.fn()}
            readOnly={false}
            isInViewport={true}
            pageTop={0}
            pageLeft={0}
          />
        );
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(page.render).toHaveBeenCalled();
      const lastCall = vi.mocked(page.render).mock.calls[0][0];
      // Viewport width at scale 1.0 on 1x display should be at least 1.5x (612 * 1.5 = 918)
      expect(lastCall.viewport.width).toBeGreaterThanOrEqual(612 * 1.5);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true, writable: true });
      root.unmount();
    }
  });

  it('renders canvas with full 2x resolution on Retina displays without artificial downscaling', async () => {
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2.0, configurable: true, writable: true });

    const root = createRoot(container);
    const doc = await pdfjsLib.getDocument({ url: 'test.pdf' }).promise;
    const page = await doc.getPage(1);
    vi.mocked(page.render).mockClear();

    try {
      await act(async () => {
        root.render(
          <PageRenderer
            pageNum={1}
            pdfDoc={doc}
            scale={1.5}
            rotation={0}
            basePageWidth={612}
            basePageHeight={792}
            annotations={[]}
            onAnnotationsChange={vi.fn()}
            readOnly={false}
            isInViewport={true}
            pageTop={0}
            pageLeft={0}
          />
        );
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(page.render).toHaveBeenCalled();
      const lastCall = vi.mocked(page.render).mock.calls[0][0];
      // At zoom 1.5 with DPR 2.0, renderScale is 3.0: 612 * 3.0 = 1836 px
      expect(lastCall.viewport.width).toBe(612 * 3.0);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true, writable: true });
      root.unmount();
    }
  });
});
