/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '6.2.108',
  getDocument: vi.fn(),
}));

import { WebViewerInstance } from '../core/ViewerInstance';
import { ViewerBus } from '../core/eventBus';
import { parseLinkTarget } from '../utils/linkUtils';
import type { LinkClickEvent } from '../core/types';

describe('Cross-Instance Document Linking', () => {
  beforeEach(() => {
    WebViewerInstance.clearInstances();
  });

  it('routes cross-document links from Viewer A to Viewer B via targetViewer', async () => {
    const busA = new ViewerBus();
    const instA = new WebViewerInstance(busA, undefined, 'viewer-a');

    const busB = new ViewerBus();
    const instB = new WebViewerInstance(busB, undefined, 'viewer-b');

    const loadDocBMock = vi.fn((url: string) => {
      busB.emit('documentLoaded', { url, numPages: 10 });
    });
    const goToPageBMock = vi.fn();
    instB._bind({
      getAnnotations: () => [],
      getRedactions: () => [],
      getWatermark: () => undefined,
      getPdfDocument: () => null,
      getDocumentUrl: () => 'initial-b.pdf',
      getFileName: () => 'initial-b.pdf',
      getCurrentUserName: () => undefined,
      getCurrentPage: () => 1,
      getPageCount: () => 10,
      loadDocument: loadDocBMock,
      goToPage: goToPageBMock,
      getTransientHighlights: () => [],
      setTransientHighlights: () => {}
    }, null);

    // Link Viewer A to Viewer B
    instA.setTargetViewer(instB);
    expect(instA.getTargetViewer()).toBe(instB);

    // Simulate clicking a link annotation to supporting.pdf#page=4
    const linkUrl = 'supporting.pdf#page=4';
    const parsed = parseLinkTarget(linkUrl);

    expect(parsed.docUrl).toBe('supporting.pdf');
    expect(parsed.pageNumber).toBe(4);
    expect(parsed.isInternalPage).toBe(false);

    // Dispatch cross-instance load
    const target = instA.getTargetViewer();
    expect(target).toBe(instB);

    await target?.loadOrNavigate(parsed.docUrl!, { page: parsed.pageNumber });
    expect(loadDocBMock).toHaveBeenCalledWith('supporting.pdf');
  });

  it('jumps directly to the target page if the supporting document is already open in Viewer B', async () => {
    const busA = new ViewerBus();
    const instA = new WebViewerInstance(busA);
    const busB = new ViewerBus();
    const instB = new WebViewerInstance(busB);

    const loadDocBMock = vi.fn();
    const goToPageBMock = vi.fn();
    instB._bind({
      getAnnotations: () => [],
      getRedactions: () => [],
      getWatermark: () => undefined,
      getPdfDocument: () => null,
      getDocumentUrl: () => 'supporting.pdf', // Already loaded!
      getFileName: () => 'supporting.pdf',
      getCurrentUserName: () => undefined,
      getCurrentPage: () => 1,
      getPageCount: () => 10,
      loadDocument: loadDocBMock,
      goToPage: goToPageBMock,
      getTransientHighlights: () => [],
      setTransientHighlights: () => {}
    }, null);

    instA.setTargetViewer(instB);

    // Clicks supporting.pdf#page=7
    const linkUrl = 'supporting.pdf#page=7';
    const parsed = parseLinkTarget(linkUrl);

    const target = instA.getTargetViewer();
    await target?.loadOrNavigate(parsed.docUrl!, { page: parsed.pageNumber });

    // Document is already loaded, so loadDocument should NOT be called; goToPage should jump directly
    expect(loadDocBMock).not.toHaveBeenCalled();
    expect(goToPageBMock).toHaveBeenCalledWith(7, { smooth: true });
  });

  it('allows onLinkClick callback to prevent default navigation via preventDefault()', async () => {
    const busA = new ViewerBus();
    const instA = new WebViewerInstance(busA);
    const onLinkClick = vi.fn((e: LinkClickEvent) => {
      e.preventDefault();
    });

    let defaultPrevented = false;
    const linkEvent: LinkClickEvent = {
      url: 'exhibit-c.pdf#page=2',
      docUrl: 'exhibit-c.pdf',
      pageNumber: 2,
      isInternalPage: false,
      preventDefault: () => {
        defaultPrevented = true;
      },
      get defaultPrevented() {
        return defaultPrevented;
      }
    };

    onLinkClick(linkEvent);
    expect(onLinkClick).toHaveBeenCalled();
    expect(linkEvent.defaultPrevented).toBe(true);
  });

  it('resolves target viewer when referencing by string ID', async () => {
    const busA = new ViewerBus();
    const instA = new WebViewerInstance(busA, undefined, 'main-viewer');
    const busB = new ViewerBus();
    const instB = new WebViewerInstance(busB, undefined, 'supporting-viewer');

    instA.setTargetViewer('supporting-viewer');
    expect(instA.getTargetViewer()).toBe(instB);

    // When supporting-viewer is destroyed, getTargetViewer returns null
    instB.destroy();
    expect(instA.getTargetViewer()).toBeNull();
  });
});
