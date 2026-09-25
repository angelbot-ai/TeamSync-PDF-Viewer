/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormFieldLayer } from './FormFieldLayer';
import { FormManager } from '../forms/FormManager';
import type { FormField } from '../forms/types';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('FormFieldLayer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders fields in Builder mode with selection and action controls', async () => {
    const field: FormField = {
      id: 'f1',
      name: 'notes',
      type: 'textarea',
      pageIndex: 1,
      x: 100,
      y: 100,
      width: 200,
      height: 80,
      label: 'Special Notes',
    };
    const formManager = new FormManager([field]);
    const setActiveTool = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldLayer
          pageNum={1}
          scale={1}
          rotation={0}
          basePageWidth={600}
          basePageHeight={800}
          activeTab="Forms"
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    expect(container.textContent).toContain('Special Notes');
    expect(container.textContent).toContain('textarea');

    // Click on the field to select it
    const fieldDiv = container.querySelector('.tspdf-form-field-builder') as HTMLDivElement;
    expect(fieldDiv).not.toBeNull();
    await act(async () => {
      fieldDiv.click();
    });

    // Check that floating action buttons appear (Settings, Duplicate, Delete)
    const settingsBtn = container.querySelector('button[title="Edit Field Properties"]');
    const deleteBtn = container.querySelector('button[title*="Delete Field"]');
    expect(settingsBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    // Click delete
    await act(async () => {
      (deleteBtn as HTMLButtonElement).click();
    });
    expect(formManager.getFields()).toHaveLength(0);
  });

  it('renders interactive HTML inputs in Filler mode (View Tab) and tracks input values', async () => {
    const textField: FormField = {
      id: 'f1',
      name: 'full_name',
      type: 'text',
      pageIndex: 1,
      x: 50,
      y: 50,
      width: 150,
      height: 35,
      placeholder: 'Enter full name',
    };
    const checklistField: FormField = {
      id: 'f2',
      name: 'interests',
      type: 'checklist',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 180,
      height: 70,
      options: ['Coding', 'Design', 'Music'],
    };
    const formManager = new FormManager([textField, checklistField]);
    const setActiveTool = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldLayer
          pageNum={1}
          scale={1}
          rotation={0}
          basePageWidth={600}
          basePageHeight={800}
          activeTab="View"
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    // Verify text input
    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput).not.toBeNull();
    expect(textInput.placeholder).toBe('Enter full name');

    // Type text into the field
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(textInput, 'Jane Doe');
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      textInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(formManager.getValue('full_name')).toBe('Jane Doe');

    // Verify checklist checkboxes
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);

    // Check "Design" (index 1)
    await act(async () => {
      (checkboxes[1] as HTMLInputElement).click();
    });

    expect(formManager.getValue('interests')).toEqual(['Design']);

    // Check "Coding" (index 0)
    await act(async () => {
      (checkboxes[0] as HTMLInputElement).click();
    });

    expect(formManager.getValue('interests')).toEqual(['Design', 'Coding']);
  });

  it('disables inputs when canFillForms is false', async () => {
    const textField: FormField = {
      id: 'f1',
      name: 'full_name',
      type: 'text',
      pageIndex: 1,
      x: 50,
      y: 50,
      width: 150,
      height: 35,
    };
    const formManager = new FormManager([textField]);
    const setActiveTool = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldLayer
          pageNum={1}
          scale={1}
          rotation={0}
          basePageWidth={600}
          basePageHeight={800}
          activeTab="View"
          activeTool="select"
          setActiveTool={setActiveTool}
          formManager={formManager}
          canFillForms={false}
        />
      );
    });

    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput.disabled).toBe(true);
  });

  it('renders textbox fields in View tab when field type is textbox or text', async () => {
    const textboxField: FormField = {
      id: 'tb1',
      name: 'user_comment',
      type: 'textbox',
      pageIndex: 1,
      x: 30,
      y: 40,
      width: 200,
      height: 36,
      placeholder: 'Type your message...',
    };
    const formManager = new FormManager([textboxField]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldLayer
          pageNum={1}
          scale={1}
          rotation={0}
          basePageWidth={600}
          basePageHeight={800}
          activeTab="View"
          activeTool="select"
          setActiveTool={vi.fn()}
          formManager={formManager}
        />
      );
    });

    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput).not.toBeNull();
    expect(textInput.placeholder).toBe('Type your message...');
  });
});
