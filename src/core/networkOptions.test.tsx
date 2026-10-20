/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist';
import { AnnotationManager } from '../annotations/AnnotationManager';
import DocumentViewer from '../components/DocumentViewer';
import { TeamSyncViewer } from '../components/TeamSyncViewer';
import { ViewerBus } from './eventBus';
import { ViewerBusContext } from './busContext';
import type { WebViewerInstance } from './ViewerInstance';

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}

if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('pdfjs-dist', () => {
  const mockPage = {
    rotate: 0,
    getViewport: vi.fn(() => ({ width: 612, height: 792 })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    getTextContent: vi.fn(() => Promise.resolve({ items: [] })),
    getAnnotations: vi.fn(() => Promise.resolve([])),
  };

  const mockDoc = {
    numPages: 5,
    getPage: vi.fn(() => Promise.resolve(mockPage)),
    getData: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    destroy: vi.fn(() => Promise.resolve()),
  };

  return {
    GlobalWorkerOptions: { workerSrc: '/pdf.worker.min.mjs' },
    version: '4.10.38',
    TextLayer: class MockTextLayer {
      render() {
        return Promise.resolve();
      }
      cancel() {}
    },
    getDocument: vi.fn((_params: any) => ({
      promise: Promise.resolve(mockDoc),
      destroy: vi.fn(() => Promise.resolve()),
    })),
  };
});

describe('Network Authentication and Streaming Options', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('forwards httpHeaders and streaming options to pdfjsLib.getDocument', async () => {
    const root = createRoot(container);
    const annotationManager = new AnnotationManager();
    const bus = new ViewerBus();

    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/secure.pdf"
            httpHeaders={{
              Authorization: 'Bearer secret-jwt-token',
              'X-Workspace-ID': 'ws-12345',
            }}
            rangeChunkSize={131072}
            disableStream={true}
            disableAutoFetch={true}
            disableRange={false}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.url).toBe('https://example.com/secure.pdf');
    expect(getDocumentArg.httpHeaders).toEqual({
      Authorization: 'Bearer secret-jwt-token',
      'X-Workspace-ID': 'ws-12345',
    });
    expect(getDocumentArg.rangeChunkSize).toBe(131072);
    expect(getDocumentArg.disableStream).toBe(true);
    expect(getDocumentArg.disableAutoFetch).toBe(true);
    expect(getDocumentArg.disableRange).toBe(false);

    act(() => {
      root.unmount();
    });
  });

  it('forwards customHeaders as an alternative header property alias', async () => {
    const root = createRoot(container);
    const annotationManager = new AnnotationManager();
    const bus = new ViewerBus();

    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/custom-headers.pdf"
            customHeaders={{
              'X-Custom-Auth': 'custom-token',
            }}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.httpHeaders).toEqual({
      'X-Custom-Auth': 'custom-token',
    });

    act(() => {
      root.unmount();
    });
  });

  it('automatically sets disableStream: true when disableAutoFetch is true per PDF.js rules', async () => {
    const root = createRoot(container);
    const annotationManager = new AnnotationManager();
    const bus = new ViewerBus();

    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/autofetch.pdf"
            disableAutoFetch={true}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.disableAutoFetch).toBe(true);
    expect(getDocumentArg.disableStream).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it('does NOT reload document when parent re-renders with fresh header object references', async () => {
    const root = createRoot(container);
    const annotationManager = new AnnotationManager();
    const bus = new ViewerBus();

    // 1st render
    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/same-url.pdf"
            httpHeaders={{ Authorization: 'Bearer initial' }}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);

    // 2nd render: new object reference for httpHeaders, but same URL and same loadNonce
    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/same-url.pdf"
            httpHeaders={{ Authorization: 'Bearer initial' }}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Crucial check: must still be called exactly 1 time! No redundant reload!
    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it('passes network options via TeamSyncViewer and instance.loadDocument(url, options)', async () => {
    let instance: WebViewerInstance | null = null;
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TeamSyncViewer
          initialDoc="https://example.com/initial.pdf"
          httpHeaders={{ Authorization: 'Bearer prop-token' }}
          disableStream={true}
          toolbar={false}
          sidebars={false}
          onReady={(inst) => {
            instance = inst;
          }}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    let lastCall = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(lastCall.httpHeaders).toEqual({ Authorization: 'Bearer prop-token' });
    expect(lastCall.disableStream).toBe(true);

    expect(instance).not.toBeNull();

    // Call instance.loadDocument with dynamic network and streaming options
    await act(async () => {
      instance!.loadDocument('https://example.com/dynamic.pdf', {
        httpHeaders: { Authorization: 'Bearer dynamic-token' },
        rangeChunkSize: 32768,
        disableAutoFetch: true,
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(2);
    lastCall = vi.mocked(pdfjsLib.getDocument).mock.calls[1][0] as any;
    expect(lastCall.url).toBe('https://example.com/dynamic.pdf');
    expect(lastCall.httpHeaders).toEqual({ Authorization: 'Bearer dynamic-token' });
    expect(lastCall.rangeChunkSize).toBe(32768);
    expect(lastCall.disableAutoFetch).toBe(true);
    expect(lastCall.disableStream).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
