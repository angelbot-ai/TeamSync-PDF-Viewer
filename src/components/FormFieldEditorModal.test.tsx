/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormFieldEditorModal } from './FormFieldEditorModal';
import type { FormField } from '../forms/types';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('FormFieldEditorModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders properties for a text field and saves updates', async () => {
    const field: FormField = {
      id: 'f1',
      name: 'first_name',
      type: 'text',
      pageIndex: 1,
      x: 50,
      y: 50,
      width: 150,
      height: 35,
      label: 'First Name',
      placeholder: 'Enter your given name',
      required: false,
    };
    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldEditorModal
          field={field}
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('Field Properties');
    expect(container.textContent).toContain('Type: text');

    // Change label and toggle required
    const inputs = container.querySelectorAll('input');
    const nameInput = inputs[0];
    const labelInput = inputs[1];
    const placeholderInput = inputs[2];
    const requiredCheckbox = container.querySelector('#field-required') as HTMLInputElement;

    await act(async () => {
      // Toggle required
      requiredCheckbox.click();
    });

    // Save changes
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Save Changes')
    );
    expect(saveBtn).not.toBeNull();

    await act(async () => {
      saveBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'first_name',
        label: 'First Name',
        placeholder: 'Enter your given name',
        required: true,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('allows adding and removing options for a checklist field', async () => {
    const field: FormField = {
      id: 'f2',
      name: 'equipment_list',
      type: 'checklist',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 80,
      label: 'Equipment Checklist',
      options: ['Hard Hat', 'Safety Glasses'],
    };
    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormFieldEditorModal
          field={field}
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('Hard Hat');
    expect(container.textContent).toContain('Safety Glasses');

    // Add a new option
    const newOptionInput = container.querySelector('input[placeholder="New item / option text"]') as HTMLInputElement;
    expect(newOptionInput).not.toBeNull();

    await act(async () => {
      // Simulate input change
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(newOptionInput, 'Steel Toe Boots');
      newOptionInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Add'));
    await act(async () => {
      addBtn?.click();
    });

    expect(container.textContent).toContain('Steel Toe Boots');

    // Click Save
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Save Changes')
    );
    await act(async () => {
      saveBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots'],
      })
    );
  });
});
