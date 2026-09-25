/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormsToolbar } from './FormsToolbar';
import { FormManager } from '../forms/FormManager';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('FormsToolbar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders all form creation tools and switches active tool', async () => {
    const setActiveTool = vi.fn();
    const formManager = new FormManager();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormsToolbar
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    expect(container.textContent).toContain('Textbox');
    expect(container.textContent).toContain('Text Area');
    expect(container.textContent).toContain('Date & Time Picker');
    expect(container.textContent).toContain('Check List');
    expect(container.textContent).toContain('Dropdown');
    expect(container.textContent).toContain('Radio Group');

    // Click on Textbox button
    const textboxBtn = container.querySelector('button[title="Textbox"]') as HTMLButtonElement;
    expect(textboxBtn).not.toBeNull();
    await act(async () => {
      textboxBtn.click();
    });
    expect(setActiveTool).toHaveBeenCalledWith('textbox');

    // Click on Check List button
    const checklistBtn = container.querySelector('button[title="Check List"]') as HTMLButtonElement;
    await act(async () => {
      checklistBtn.click();
    });
    expect(setActiveTool).toHaveBeenCalledWith('checklist');
  });

  it('handles undo and redo state', async () => {
    const formManager = new FormManager();
    const setActiveTool = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormsToolbar
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    const undoBtn = container.querySelector('button[title="Undo"]') as HTMLButtonElement;
    const redoBtn = container.querySelector('button[title="Redo"]') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);

    // Add field
    await act(async () => {
      formManager.addField({
        id: 'f1',
        name: 'test_field',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 30,
      });
      root.render(
        <FormsToolbar
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    expect(undoBtn.disabled).toBe(false);

    // Click undo
    await act(async () => {
      undoBtn.click();
    });
    expect(formManager.getFields()).toHaveLength(0);
  });

  it('triggers clear all fields with confirmation', async () => {
    const formManager = new FormManager([
      {
        id: 'f1',
        name: 'field_1',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 30,
      },
    ]);
    const setActiveTool = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormsToolbar
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    const clearBtn = container.querySelector('button[title="Clear all fields"]') as HTMLButtonElement;
    await act(async () => {
      clearBtn.click();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(formManager.getFields()).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('calls onSwitchToView when test form button is clicked', async () => {
    const formManager = new FormManager();
    const setActiveTool = vi.fn();
    const onSwitchToView = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormsToolbar
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
          onSwitchToView={onSwitchToView}
        />
      );
    });

    const testFormBtn = container.querySelector('button[title="Preview and fill this form in View mode"]') as HTMLButtonElement;
    await act(async () => {
      testFormBtn.click();
    });
    expect(onSwitchToView).toHaveBeenCalled();
  });
});
