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
});
