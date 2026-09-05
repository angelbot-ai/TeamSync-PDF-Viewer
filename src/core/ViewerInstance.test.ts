import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '6.2.108',
  getDocument: vi.fn(),
}));

import { ViewerBus } from './eventBus';
import { WebViewerInstance } from './ViewerInstance';

describe('WebViewerInstance', () => {
  it('throws clearly when used before mount', async () => {
    const inst = new WebViewerInstance(new ViewerBus());
    expect(inst.isMounted).toBe(false);
    expect(() => inst.loadDocument('x.pdf')).toThrow(/not mounted/);
    await expect(inst.getFileData()).rejects.toThrow(/not mounted/);
    expect(inst.getAnnotations()).toEqual([]);
  });

  it('routes UI facade calls through the instance bus', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const fn = vi.fn();
    bus.on('action-open-elements', fn);
    inst.UI.openElements(['leftPanel']);
    expect(fn).toHaveBeenCalledWith({ elements: ['leftPanel'] });
  });

  it('loadDocument resolves on documentLoaded and rejects on documentLoadError', async () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const loadDocument = vi.fn((url: string) => {
      queueMicrotask(() => {
        if (url.endsWith('bad.pdf')) bus.emit('documentLoadError', { url, error: new Error('nope'), passwordRequired: false });
        else bus.emit('documentLoaded', { url, numPages: 3 });
      });
    });
    inst._bind(
      {
        getAnnotations: () => [],
        getRedactions: () => [],
        getWatermark: () => undefined,
        getPdfDocument: () => null,
        getDocumentUrl: () => undefined,
        getFileName: () => undefined,
        getCurrentUserName: () => undefined,
        getCurrentPage: () => 1,
        getPageCount: () => 0,
        loadDocument,
      },
      null
    );
    await expect(inst.loadDocument('/good.pdf')).resolves.toEqual({ url: '/good.pdf', numPages: 3 });
    await expect(inst.loadDocument('/bad.pdf')).rejects.toThrow('nope');
    expect(bus.listenerCount()).toBe(0);
  });

  it('destroy() is idempotent, emits destroy and unmounts the root', async () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const unmount = vi.fn();
    const onDestroy = vi.fn();
    inst._setUnmount(unmount);
    inst.on('destroy', onDestroy);
    inst.destroy();
    inst.destroy();
    await Promise.resolve();
    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(inst.isDestroyed).toBe(true);
    expect(bus.isDestroyed).toBe(true);
  });

  it('supports programmatic page navigation via goToPage and setCurrentPage', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const goToPageMock = vi.fn();
    inst._bind(
      {
        getAnnotations: () => [],
        getRedactions: () => [],
        getWatermark: () => undefined,
        getPdfDocument: () => null,
        getDocumentUrl: () => undefined,
        getFileName: () => undefined,
        getCurrentUserName: () => undefined,
        getCurrentPage: () => 1,
        getPageCount: () => 10,
        loadDocument: vi.fn(),
        goToPage: goToPageMock,
      },
      null
    );

    inst.goToPage(3, { smooth: true });
    expect(goToPageMock).toHaveBeenCalledWith(3, { smooth: true });

    inst.setCurrentPage(5);
    expect(goToPageMock).toHaveBeenCalledWith(5, {});

    inst.UI.setCurrentPageNumber(7);
    expect(goToPageMock).toHaveBeenCalledWith(7, {});

    inst.Core.documentViewer.setCurrentPage(2);
    expect(goToPageMock).toHaveBeenCalledWith(2, {});
  });

  it('manages transient highlights without polluting getAnnotations()', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const setHighlightsMock = vi.fn();
    let currentHighlights: any[] = [];
    inst._bind(
      {
        getAnnotations: () => [],
        getRedactions: () => [],
        getWatermark: () => undefined,
        getPdfDocument: () => null,
        getDocumentUrl: () => undefined,
        getFileName: () => undefined,
        getCurrentUserName: () => undefined,
        getCurrentPage: () => 1,
        getPageCount: () => 10,
        loadDocument: vi.fn(),
        getTransientHighlights: () => currentHighlights,
        setTransientHighlights: setHighlightsMock.mockImplementation((hl) => {
          currentHighlights = hl;
        }),
      },
      null
    );

    const onHighlightsChanged = vi.fn();
    inst.on('transientHighlightsChanged', onHighlightsChanged);

    const sample = {
      id: 'th-1',
      pageIndex: 1,
      bounds: [{ x: 10, y: 20, width: 100, height: 15 }],
      color: 'rgba(255, 220, 0, 0.4)',
    };

    inst.setTransientHighlights([sample]);
    expect(setHighlightsMock).toHaveBeenCalledWith([sample]);
    expect(onHighlightsChanged).toHaveBeenCalledWith({ highlights: [sample] });

    // Ensure getAnnotations() remains completely clean / unaffected
    expect(inst.getAnnotations()).toEqual([]);

    inst.addTransientHighlight({
      id: 'th-2',
      pageIndex: 2,
      bounds: [{ x: 30, y: 40, width: 50, height: 12 }],
    });
    expect(currentHighlights).toHaveLength(2);

    inst.clearTransientHighlights();
    expect(currentHighlights).toEqual([]);
    expect(inst.getAnnotations()).toEqual([]);
  });

  it('searchText performs text searching across the document', async () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Hello World', transform: [10, 0, 0, 10, 50, 100], width: 80, height: 12 },
        ],
      }),
    };
    const mockPdfDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    inst._bind(
      {
        getAnnotations: () => [],
        getRedactions: () => [],
        getWatermark: () => undefined,
        getPdfDocument: () => mockPdfDoc as any,
        getDocumentUrl: () => undefined,
        getFileName: () => undefined,
        getCurrentUserName: () => undefined,
        getCurrentPage: () => 1,
        getPageCount: () => 1,
        loadDocument: vi.fn(),
      },
      null
    );

    const results = await inst.searchText('Hello');
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain('Hello World');
    expect(results[0].pageIndex).toBe(1);
    expect(results[0].bounds).toBeDefined();
  });

  it('supports pageRendered event subscription and emission', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const onPageRendered = vi.fn();
    inst.on('pageRendered', onPageRendered);

    bus.emit('pageRendered', { url: '/doc.pdf', pageNumber: 2 });
    expect(onPageRendered).toHaveBeenCalledWith({ url: '/doc.pdf', pageNumber: 2 });
  });

  it('supports getSelectedText and copySelectedText', async () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const onTextCopied = vi.fn();
    inst.on('textCopied', onTextCopied);

    // When nothing selected
    vi.spyOn(window, 'getSelection').mockReturnValue(null);
    expect(inst.getSelectedText()).toBe('');
    expect(await inst.copySelectedText()).toBe(false);

    // Mock active selection
    const mockSelection = {
      toString: () => 'Sample selected text',
      isCollapsed: false,
      rangeCount: 1,
    } as any;
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection);

    expect(inst.getSelectedText()).toBe('Sample selected text');
    expect(inst.UI.getSelectedText()).toBe('Sample selected text');

    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    const copied = await inst.copySelectedText();
    expect(copied).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Sample selected text');
    expect(onTextCopied).toHaveBeenCalledWith({ text: 'Sample selected text' });
  });

  it('normalizes tool modes in UI.setToolMode', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const onTool = vi.fn();
    bus.on('action-set-tool', onTool);

    inst.UI.setToolMode('select');
    expect(onTool).toHaveBeenLastCalledWith({ tool: 'select' });

    inst.UI.setToolMode('TextSelect');
    expect(onTool).toHaveBeenLastCalledWith({ tool: 'select' });

    inst.UI.setToolMode('pan');
    expect(onTool).toHaveBeenLastCalledWith({ tool: 'pan' });

    inst.UI.setToolMode('rectangle');
    expect(onTool).toHaveBeenLastCalledWith({ tool: 'rectangle' });
  });

  it('getRedactions() returns empty array when unmounted and live redactions when mounted', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    expect(inst.getRedactions()).toEqual([]);

    const sampleRedactions = [
      { id: 'r1', pageIndex: 1, x: 10, y: 10, width: 100, height: 20, status: 'pending' as const },
      { id: 'r2', pageIndex: 1, x: 10, y: 50, width: 100, height: 20, status: 'applied' as const },
    ];

    inst._bind(
      {
        getAnnotations: () => [],
        getRedactions: () => sampleRedactions,
        getWatermark: () => undefined,
        getPdfDocument: () => null,
        getDocumentUrl: () => undefined,
        getFileName: () => undefined,
        getCurrentUserName: () => undefined,
        getCurrentPage: () => 1,
        getPageCount: () => 1,
        loadDocument: vi.fn(),
        goToPage: vi.fn(),
        getTransientHighlights: () => [],
        setTransientHighlights: vi.fn(),
      },
      null
    );

    expect(inst.getRedactions()).toEqual(sampleRedactions);
  });

  it('subscribes to redactionsChanged and redactionsApplied events', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);
    const onRedactionsChanged = vi.fn();
    const onRedactionsApplied = vi.fn();

    const offChanged = inst.on('redactionsChanged', onRedactionsChanged);
    const offApplied = inst.on('redactionsApplied', onRedactionsApplied);

    const pending = [{ pageIndex: 1, x: 10, y: 10, width: 50, height: 20, status: 'pending' as const }];
    const applied = [{ pageIndex: 1, x: 10, y: 10, width: 50, height: 20, status: 'applied' as const }];

    bus.emit('redactionsChanged', { redactions: pending });
    expect(onRedactionsChanged).toHaveBeenCalledWith({ redactions: pending });

    bus.emit('redactionsApplied', { redactions: applied });
    expect(onRedactionsApplied).toHaveBeenCalledWith({ redactions: applied });

    offChanged();
    offApplied();

    bus.emit('redactionsChanged', { redactions: [] });
    bus.emit('redactionsApplied', { redactions: [] });
    expect(onRedactionsChanged).toHaveBeenCalledTimes(1);
    expect(onRedactionsApplied).toHaveBeenCalledTimes(1);
  });
});
