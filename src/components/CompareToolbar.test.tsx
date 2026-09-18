/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CompareToolbar from './CompareToolbar';
import type { CompareState } from '../types/compare';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('CompareToolbar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const baseCompareState: CompareState = {
    isActive: true,
    mode: 'side-by-side',
    colorA: '#e11d48',
    colorB: '#2563eb',
    opacityA: 0.8,
    opacityB: 0.8,
    blendMode: 'difference',
    showCurtain: false,
    curtainPosition: 50,
    diffItems: [
      { id: 'diff-1', pageIndex: 1, type: 'modification', description: 'Difference 1' },
      { id: 'diff-2', pageIndex: 1, type: 'addition', description: 'Difference 2' }
    ],
    currentDiffIndex: 0
  };

  it('renders mode buttons, zoom controls, and pan/select tools', async () => {
    const onSetMode = vi.fn();
    const onSetColors = vi.fn();
    const onToggleCurtain = vi.fn();
    const onPrevDiff = vi.fn();
    const onNextDiff = vi.fn();
    const onExit = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFit90 = vi.fn();
    const onSetTool = vi.fn();

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CompareToolbar
          compareState={baseCompareState}
          onSetMode={onSetMode}
          onSetColors={onSetColors}
          onToggleCurtain={onToggleCurtain}
          onPrevDiff={onPrevDiff}
          onNextDiff={onNextDiff}
          onExit={onExit}
          is90Fit={true}
          zoomMultiplier={1.0}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFit90={onFit90}
          activeTool="pan"
          onSetTool={onSetTool}
        />
      );
    });

    expect(container.textContent).toContain('Document Compare');
    expect(container.textContent).toContain('Side-by-Side');
    expect(container.textContent).toContain('90% Fit');
    expect(container.textContent).toContain('Pan');
    expect(container.textContent).toContain('Select');
    expect(container.textContent).toContain('1 of 2 diffs');

    // Test Zoom In click
    const zoomInBtn = container.querySelector('button[title*="Zoom In"]');
    expect(zoomInBtn).not.toBeNull();
    await act(async () => {
      (zoomInBtn as HTMLButtonElement).click();
    });
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    // Test Zoom Out click
    const zoomOutBtn = container.querySelector('button[title*="Zoom Out"]');
    expect(zoomOutBtn).not.toBeNull();
    await act(async () => {
      (zoomOutBtn as HTMLButtonElement).click();
    });
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    // Test 90% Fit click
    const fit90Btn = container.querySelector('button[title*="Reset both documents to 90% window fit"]');
    expect(fit90Btn).not.toBeNull();
    await act(async () => {
      (fit90Btn as HTMLButtonElement).click();
    });
    expect(onFit90).toHaveBeenCalledTimes(1);

    // Test Tool switcher click
    const selectBtn = container.querySelector('button[title*="Select"]');
    expect(selectBtn).not.toBeNull();
    await act(async () => {
      (selectBtn as HTMLButtonElement).click();
    });
    expect(onSetTool).toHaveBeenCalledWith('select');

    // Test Exit button click
    const exitBtn = container.querySelector('button[title*="Exit Compare Mode"]');
    expect(exitBtn).not.toBeNull();
    await act(async () => {
      (exitBtn as HTMLButtonElement).click();
    });
    expect(onExit).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('displays custom zoom percentage when zoomed in', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CompareToolbar
          compareState={baseCompareState}
          onSetMode={vi.fn()}
          onSetColors={vi.fn()}
          onToggleCurtain={vi.fn()}
          onPrevDiff={vi.fn()}
          onNextDiff={vi.fn()}
          onExit={vi.fn()}
          is90Fit={false}
          zoomMultiplier={1.35}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFit90={vi.fn()}
          activeTool="select"
          onSetTool={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('135%');

    await act(async () => {
      root.unmount();
    });
  });
});
