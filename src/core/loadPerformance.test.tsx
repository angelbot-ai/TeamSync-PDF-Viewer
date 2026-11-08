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
import PageRenderer from '../components/PageRenderer';
import { ViewerBus } from './eventBus';
import { ViewerBusContext } from './busContext';
import { createPdfWorker } from './pdfAssets';

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
  const pagesCache = new Map<number, any>();
  const getPageMock = vi.fn((pageNum: number) => {
    if (!pagesCache.has(pageNum)) {
      pagesCache.set(pageNum, {
        rotate: 0,
        getViewport: vi.fn(() => ({ width: 612, height: 792 })),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
        getTextContent: vi.fn(() => Promise.resolve({ items: [{ str: `Page ${pageNum} text`, transform: [1, 0, 0, 1, 10, 10], width: 50, height: 10 }] })),
        getAnnotations: vi.fn(() => Promise.resolve([
          { subtype: 'Link', rect: [10, 10, 60, 20], url: 'https://example.com' }
        ])),
        cleanup: vi.fn(),
      });
    }
    return Promise.resolve(pagesCache.get(pageNum));
  });

  const mockDoc = {
    numPages: 50,
    getPage: getPageMock,
    getData: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    destroy: vi.fn(() => Promise.resolve()),
  };

  class MockPDFWorker {
    destroyed = false;
    destroy() {
      this.destroyed = true;
    }
  }

  return {
    GlobalWorkerOptions: { workerSrc: '/pdf.worker.min.mjs' },
    version: '4.10.38',
    PDFWorker: MockPDFWorker,
    PDFDataRangeTransport: class MockPDFDataRangeTransport {
      length: number;
      initialData: any;
      constructor(length: number, initialData: any) {
        this.length = length;
        this.initialData = initialData;
      }
      onDataRange() {}
      onDataProgressiveRead() {}
      onDataProgressiveDone() {}
      transportReady() {}
      requestDataRange() {}
      abort() {}
    },
    TextLayer: class MockTextLayer {
      render() {
        return Promise.resolve();
      }
      cancel() {}
    },
    getDocument: vi.fn((params: any) => {
      const task: any = {
        promise: Promise.resolve(mockDoc),
        destroy: vi.fn(() => Promise.resolve()),
      };
      if (params.url && params.url.includes('progress')) {
        setTimeout(() => {
          task.onProgress?.({ loaded: 524288, total: 2097152 });
          task.onProgress?.({ loaded: 1048576, total: 2097152 });
        }, 5);
      }
      return task;
    }),
  };
});

describe('PDF Viewer Load Performance & Optimization Suite', () => {
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

  it('defaults network parameters to disableStream: true and rangeChunkSize: 524288 (512 KiB)', async () => {
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
            initialDoc="https://example.com/ongc-report.pdf"
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
            pageTransition="continuous"
            pageLayout="single"
            rotation={0}
            setRotation={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.url).toBe('https://example.com/ongc-report.pdf');
    expect(getDocumentArg.disableStream).toBe(true);
    expect(getDocumentArg.rangeChunkSize).toBe(524288);
    expect(getDocumentArg.worker).toBeDefined();

    act(() => {
      root.unmount();
    });
  });

  it('allows explicit host override of network streaming options', async () => {
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
            initialDoc="https://example.com/custom.pdf"
            disableStream={false}
            rangeChunkSize={65536}
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
            pageTransition="continuous"
            pageLayout="single"
            rotation={0}
            setRotation={vi.fn()}
          />
        </ViewerBusContext.Provider>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.disableStream).toBe(false);
    expect(getDocumentArg.rangeChunkSize).toBe(65536);

    act(() => {
      root.unmount();
    });
  });

  it('accepts and passes a custom shared worker instance from host', async () => {
    const root = createRoot(container);
    const customWorker = createPdfWorker();
    const onFirstPageRendered = vi.fn();

    await act(async () => {
      root.render(
        <TeamSyncViewer
          initialDoc="https://example.com/with-worker.pdf"
          worker={customWorker}
          onFirstPageRendered={onFirstPageRendered}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    const getDocumentArg = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as any;
    expect(getDocumentArg.worker).toBe(customWorker);

    act(() => {
      root.unmount();
    });
  });

  it('lazy dimension scan: does not issue getPage(2..N) before onFirstPageRendered on multi-page docs', async () => {
    const root = createRoot(container);
    const annotationManager = new AnnotationManager();
    const bus = new ViewerBus();
    const onFirstPageRendered = vi.fn();

    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <DocumentViewer
            leftSidebarOpen={false}
            rightSidebarOpen={false}
            activeTab="View"
            annotationManager={annotationManager}
            initialDoc="https://example.com/50-pages.pdf"
            scale={1}
            setScale={vi.fn()}
            sidebarTab="Comments"
            setSidebarTab={vi.fn()}
            pageTransition="continuous"
            pageLayout="single"
            rotation={0}
            setRotation={vi.fn()}
            onFirstPageRendered={onFirstPageRendered}
          />
        </ViewerBusContext.Provider>
      );
    });

    // Wait short period for initial doc load and Page 1 getPage
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const getPageCalls = (pdfjsLib.getDocument({ url: '' }).promise as any)
      .then
      ? vi.mocked((await pdfjsLib.getDocument({ url: '' }).promise).getPage).mock.calls.map((c: any) => c[0])
      : [];

    // Before or at first page rendered, only Page 1 should have been queried
    const offscreenBeforeFirstPaint = getPageCalls.filter((p: number) => p > 1);
    expect(offscreenBeforeFirstPaint.length).toBe(0);

    act(() => {
      root.unmount();
    });
  });

  it('gates text extraction and link extraction on viewport in PageRenderer', async () => {
    const root = createRoot(container);
    const doc = await pdfjsLib.getDocument({ url: 'test.pdf' }).promise;
    const pageProxy = await doc.getPage(2);
    vi.mocked(pageProxy.getTextContent).mockClear();
    vi.mocked(pageProxy.getAnnotations).mockClear();

    // 1. Mount off-screen (isInViewport = false)
    await act(async () => {
      root.render(
        <PageRenderer
          pageNum={2}
          pdfDoc={doc}
          scale={1}
          rotation={0}
          basePageWidth={612}
          basePageHeight={792}
          annotations={[]}
          onAnnotationsChange={vi.fn()}
          readOnly={false}
          isInViewport={false}
          pageTop={800}
          pageLeft={0}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pageProxy.getTextContent).not.toHaveBeenCalled();
    expect(pageProxy.getAnnotations).not.toHaveBeenCalled();

    // 2. Scroll into viewport (isInViewport = true)
    await act(async () => {
      root.render(
        <PageRenderer
          pageNum={2}
          pdfDoc={doc}
          scale={1}
          rotation={0}
          basePageWidth={612}
          basePageHeight={792}
          annotations={[]}
          onAnnotationsChange={vi.fn()}
          readOnly={false}
          isInViewport={true}
          pageTop={800}
          pageLeft={0}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pageProxy.getTextContent).toHaveBeenCalledTimes(1);
    expect(pageProxy.getAnnotations).toHaveBeenCalledTimes(1);

    // 3. Scroll back out of viewport and in again - should NOT re-fetch
    await act(async () => {
      root.render(
        <PageRenderer
          pageNum={2}
          pdfDoc={doc}
          scale={1}
          rotation={0}
          basePageWidth={612}
          basePageHeight={792}
          annotations={[]}
          onAnnotationsChange={vi.fn()}
          readOnly={false}
          isInViewport={false}
          pageTop={800}
          pageLeft={0}
        />
      );
    });

    await act(async () => {
      root.render(
        <PageRenderer
          pageNum={2}
          pdfDoc={doc}
          scale={1}
          rotation={0}
          basePageWidth={612}
          basePageHeight={792}
          annotations={[]}
          onAnnotationsChange={vi.fn()}
          readOnly={false}
          isInViewport={true}
          pageTop={800}
          pageLeft={0}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(pageProxy.getTextContent).toHaveBeenCalledTimes(1);
    expect(pageProxy.getAnnotations).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it('reports load telemetry via onLoadProgress and onFirstPageRendered', async () => {
    const root = createRoot(container);
    const onLoadProgress = vi.fn();
    const onFirstPageRendered = vi.fn();

    await act(async () => {
      root.render(
        <TeamSyncViewer
          initialDoc="https://example.com/progress-doc.pdf"
          onLoadProgress={onLoadProgress}
          onFirstPageRendered={onFirstPageRendered}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(onLoadProgress).toHaveBeenCalled();
    const progressArg = onLoadProgress.mock.calls[onLoadProgress.mock.calls.length - 1][0];
    expect(progressArg.bytesLoaded).toBeGreaterThan(0);
    expect(progressArg.totalBytes).toBe(2097152);

    act(() => {
      root.unmount();
    });
  });

  it('does not block onDocumentLoaded on AcroForm field extraction (Item 8b)', async () => {
    const root = createRoot(container);
    let documentLoadedFired = false;

    const onDocumentLoaded = vi.fn(() => {
      documentLoadedFired = true;
    });

    await act(async () => {
      root.render(
        <TeamSyncViewer
          initialDoc="https://example.com/test-doc.pdf"
          onDocumentLoaded={onDocumentLoaded}
        />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });

    expect(onDocumentLoaded).toHaveBeenCalled();
    expect(documentLoadedFired).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
