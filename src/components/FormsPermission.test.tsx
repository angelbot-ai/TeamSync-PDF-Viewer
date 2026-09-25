/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './Header';
import { ViewerBus } from '../core/eventBus';
import { ViewerBusContext } from '../core/busContext';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Forms Permissions and Tab Visibility', () => {
  let container: HTMLDivElement;
  let bus: ViewerBus;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    bus = new ViewerBus();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const renderHeader = async (props: Partial<React.ComponentProps<typeof Header>> = {}) => {
    const defaultProps: React.ComponentProps<typeof Header> = {
      activeTab: 'View',
      setActiveTab: vi.fn(),
      leftSidebarOpen: false,
      setLeftSidebarOpen: vi.fn(),
      rightSidebarOpen: false,
      setRightSidebarOpen: vi.fn(),
      sidebarTab: 'Comments',
      scale: 1,
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onZoomSet: vi.fn(),
      onDownload: vi.fn(),
      onFullScreen: vi.fn(),
      onSaveAs: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenAbout: vi.fn(),
      onOpenSidebarTab: vi.fn(),
      pageTransition: 'continuous',
      setPageTransition: vi.fn(),
      pageLayout: 'single',
      setPageLayout: vi.fn(),
      rotation: 0,
      setRotation: vi.fn(),
      ...props,
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ViewerBusContext.Provider value={bus}>
          <Header {...defaultProps} />
        </ViewerBusContext.Provider>
      );
    });
    return root;
  };

  it('displays View, Annotate, and Forms tabs by default', async () => {
    await renderHeader();
    expect(container.textContent).toContain('View');
    expect(container.textContent).toContain('Annotate');
    expect(container.textContent).toContain('Forms');
  });

  it('hides Forms tab when canCreateForms is false', async () => {
    await renderHeader({
      permissions: { canCreateForms: false },
    });
    expect(container.textContent).toContain('View');
    expect(container.textContent).toContain('Annotate');
    expect(container.textContent).not.toContain('Forms');
  });

  it('shows only View tab when user has view-only role (canAddAnnotations: false, canCreateForms: false)', async () => {
    await renderHeader({
      permissions: { canAddAnnotations: false, canCreateForms: false },
    });
    expect(container.textContent).toContain('View');
    expect(container.textContent).not.toContain('Annotate');
    expect(container.textContent).not.toContain('Forms');
  });

  it('allows clicking Forms tab to activate it when permitted', async () => {
    const setActiveTab = vi.fn();
    await renderHeader({ setActiveTab });

    const formsTab = Array.from(container.querySelectorAll('div')).find(
      (el) => el.textContent === 'Forms' && el.style.cursor === 'pointer'
    );
    expect(formsTab).toBeDefined();

    await act(async () => {
      formsTab?.click();
    });
    expect(setActiveTab).toHaveBeenCalledWith('Forms');
  });
});
