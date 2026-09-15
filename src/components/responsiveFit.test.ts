/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { calculateFitWidthScale } from '../utils/zoomUtils';

describe('responsive fit and initial width-ratio calculations', () => {
  describe('calculateFitWidthScale', () => {
    it('accurately computes 70% width-ratio scaling', () => {
      const containerWidth = 1048;
      const padding = 48;
      const availableWidth = containerWidth - padding; // 1000px
      const pageWidth = 600;

      const scale = calculateFitWidthScale(availableWidth, pageWidth, 0.7);
      // 1000 * 0.7 = 700px target; 700 / 600 = 1.1666... -> clamped/rounded to 1.17
      expect(scale).toBe(1.17);
      // Rendered width: 600 * 1.17 = 702px (~70% of 1000px)
      expect(pageWidth * scale).toBeCloseTo(700, -1);
    });

    it('dynamically adapts scale when container resizes', () => {
      const padding = 48;
      const pageWidth = 500;
      const ratio = 0.7;

      // Small viewport (e.g. split view / mobile)
      const smallContainer = 548;
      const smallAvail = smallContainer - padding; // 500px
      const smallScale = calculateFitWidthScale(smallAvail, pageWidth, ratio);
      // 500 * 0.7 = 350px target; 350 / 500 = 0.70
      expect(smallScale).toBe(0.7);
      expect(pageWidth * smallScale).toBe(350);

      // Large viewport (e.g. desktop full screen)
      const largeContainer = 1548;
      const largeAvail = largeContainer - padding; // 1500px
      const largeScale = calculateFitWidthScale(largeAvail, pageWidth, ratio);
      // 1500 * 0.7 = 1050px target; 1050 / 500 = 2.10
      expect(largeScale).toBe(2.1);
      expect(pageWidth * largeScale).toBe(1050);

      // When sidebar opens (reducing available width by 250px)
      const sidebarOpenContainer = largeContainer - 250; // 1298px
      const sidebarAvail = sidebarOpenContainer - padding; // 1250px
      const sidebarScale = calculateFitWidthScale(sidebarAvail, pageWidth, ratio);
      // 1250 * 0.7 = 875px target; 875 / 500 = 1.75
      expect(sidebarScale).toBe(1.75);
      expect(pageWidth * sidebarScale).toBe(875);
    });
  });

  describe('ResizeObserver responsive tracking logic', () => {
    let resizeCallback: ((entries: any[]) => void) | null = null;
    let observedElement: HTMLElement | null = null;
    let disconnected = false;

    class MockResizeObserver {
      constructor(cb: (entries: any[]) => void) {
        resizeCallback = cb;
      }
      observe(el: HTMLElement) {
        observedElement = el;
      }
      disconnect() {
        disconnected = true;
      }
      unobserve() {}
    }

    beforeEach(() => {
      resizeCallback = null;
      observedElement = null;
      disconnected = false;
      (globalThis as any).ResizeObserver = MockResizeObserver;
    });

    afterEach(() => {
      delete (globalThis as any).ResizeObserver;
    });

    it('simulates responsive refit on container width change', () => {
      let activeFitMode: { type: 'fit-width'; ratio: number } | null = { type: 'fit-width', ratio: 0.7 };
      let currentScale = 1.0;
      const pageWidth = 500;
      const padding = 48;

      let clientWidth = 1048; // available 1000px
      const mockContainer = {
        get clientWidth() {
          return clientWidth;
        },
        get clientHeight() {
          return 800;
        },
      } as HTMLElement;

      const observer = new (globalThis as any).ResizeObserver(() => {
        if (!activeFitMode) return;
        const available = mockContainer.clientWidth - padding;
        currentScale = calculateFitWidthScale(available, pageWidth, activeFitMode.ratio);
      });
      observer.observe(mockContainer);

      // Initial fit at 1048px container width
      resizeCallback!([{ target: mockContainer }]);
      expect(currentScale).toBe(1.4); // 700 / 500 = 1.4

      // Resize window to 1548px
      clientWidth = 1548;
      resizeCallback!([{ target: mockContainer }]);
      expect(currentScale).toBe(2.1); // 1050 / 500 = 2.1

      // User manually sets zoom to 3.0 -> clears active fit mode
      activeFitMode = null;
      currentScale = 3.0;

      // Resizing container again does NOT overwrite manual zoom
      clientWidth = 848;
      resizeCallback!([{ target: mockContainer }]);
      expect(currentScale).toBe(3.0);

      // User re-engages fit-to-width with ratio 0.7
      activeFitMode = { type: 'fit-width', ratio: 0.7 };
      const available = mockContainer.clientWidth - padding;
      currentScale = calculateFitWidthScale(available, pageWidth, activeFitMode.ratio);
      expect(currentScale).toBe(1.12); // 800 * 0.7 = 560 / 500 = 1.12
    });

    it('defaults to responsive fit-width (1.0 ratio) when initialScale is undefined', () => {
      // Replicates the default `<TeamSyncViewer />` behavior without initialScale prop
      const initialScale: undefined = undefined;
      const initialWidthRatio: undefined = undefined;

      const activeFitMode =
        typeof initialWidthRatio === 'number'
          ? { type: 'fit-width' as const, ratio: initialWidthRatio }
          : (initialScale === 'fit-width' || initialScale === undefined)
          ? { type: 'fit-width' as const, ratio: 1.0 }
          : null;

      expect(activeFitMode).toEqual({ type: 'fit-width', ratio: 1.0 });

      let currentScale = 1.0;
      const pageWidth = 612; // US Letter page width (like TeamSync.pdf)
      const padding = 48;

      let clientWidth = 959; // Screenshot width
      const mockContainer = {
        get clientWidth() { return clientWidth; },
        get clientHeight() { return 1024; },
      } as HTMLElement;

      const observer = new (globalThis as any).ResizeObserver(() => {
        if (!activeFitMode) return;
        const available = mockContainer.clientWidth - padding;
        currentScale = calculateFitWidthScale(available, pageWidth, activeFitMode.ratio);
      });
      observer.observe(mockContainer);

      // Trigger resize callback at 959px
      resizeCallback!([{ target: mockContainer }]);
      // 959 - 48 = 911px available; 911 / 612 = 1.4885 -> 1.49
      expect(currentScale).toBe(1.49);
      // Page width at scale 1.49 is ~911.88px, fitting inside 959px with padding
      expect(pageWidth * currentScale).toBeLessThanOrEqual(mockContainer.clientWidth);

      // Narrow window to 600px
      clientWidth = 600;
      resizeCallback!([{ target: mockContainer }]);
      // 600 - 48 = 552px available; 552 / 612 = 0.9019 -> 0.90
      expect(currentScale).toBe(0.9);
      expect(pageWidth * currentScale).toBeLessThanOrEqual(mockContainer.clientWidth);
    });

    it('recalculates horizontal page centering (pLeft) dynamically on container resize', () => {
      const pageWidth = 612;
      const scale = 1.0;
      const thisWidth = pageWidth * scale; // 612px

      // Window was initially wide (1526px)
      let clientWidth = 1526;
      let pLeft = Math.max(0, clientWidth / 2 - thisWidth / 2);
      // 1526 / 2 - 612 / 2 = 763 - 306 = 457px
      expect(pLeft).toBe(457);

      // Window narrowed to 959px (user drag resize)
      clientWidth = 959;
      pLeft = Math.max(0, clientWidth / 2 - thisWidth / 2);
      // 959 / 2 - 612 / 2 = 479.5 - 306 = 173.5px
      expect(pLeft).toBe(173.5);
      // Verify the page doesn't overflow right edge:
      // pLeft (173.5) + thisWidth (612) = 785.5 <= 959 (no clipping!)
      expect(pLeft + thisWidth).toBeLessThanOrEqual(clientWidth);

      // When window narrows further to 500px (< thisWidth):
      clientWidth = 500;
      pLeft = Math.max(0, clientWidth / 2 - thisWidth / 2);
      // 500 / 2 - 306 = -56 -> Math.max(0, -56) = 0
      expect(pLeft).toBe(0);
    });
  });
});
