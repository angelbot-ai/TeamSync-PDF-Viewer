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

  it('renders custom typography, colors, and borders in View mode', async () => {
    const styledField: FormField = {
      id: 'styled1',
      name: 'custom_notes',
      type: 'text',
      pageIndex: 1,
      x: 30,
      y: 40,
      width: 200,
      height: 36,
      textColor: '#dc2626',
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444',
      borderWidth: 2,
      borderRadius: 8,
      fontSize: 18,
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
    };
    const formManager = new FormManager([styledField]);
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

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.style.color).toBe('rgb(220, 38, 38)'); // #dc2626
    expect(input.style.backgroundColor).toBe('rgb(254, 242, 242)'); // #fef2f2
    expect(input.style.borderColor).toBe('rgb(239, 68, 68)');
    expect(input.style.borderWidth).toBe('2px');
    expect(input.style.borderRadius).toBe('8px');
    expect(input.style.fontSize).toBe('18px');
    expect(input.style.fontWeight).toBe('bold');
    expect(input.style.fontStyle).toBe('italic');
    expect(input.style.textAlign).toBe('center');
  });

  it('locks fields assigned to other users and displays lock badge in View mode', async () => {
    const userAField: FormField = {
      id: 'field_a',
      name: 'user_a_field',
      type: 'text',
      pageIndex: 1,
      x: 20,
      y: 20,
      width: 150,
      height: 35,
      roleId: 'user_a',
    };
    const userBField: FormField = {
      id: 'field_b',
      name: 'user_b_field',
      type: 'text',
      pageIndex: 1,
      x: 20,
      y: 70,
      width: 150,
      height: 35,
      roleId: 'user_b',
    };

    const formManager = new FormManager([userAField, userBField]);
    // Set current active filler to User A
    formManager.setCurrentRole('user_a');
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

    const inputA = container.querySelector('#tspdf-field-field_a') as HTMLInputElement;
    const inputB = container.querySelector('#tspdf-field-field_b') as HTMLInputElement;

    expect(inputA).not.toBeNull();
    expect(inputB).not.toBeNull();

    // User A field is editable
    expect(inputA.disabled).toBe(false);

    // User B field is locked/disabled for User A
    expect(inputB.disabled).toBe(true);
    // Lock indicator text is present
    expect(container.textContent).toContain('User B');
  });

  it('navigates next and previous fields on Tab and Shift+Tab keydown', async () => {
    const field1: FormField = {
      id: 'f1',
      name: 'first_name',
      type: 'text',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 100,
      height: 30,
      flowOrder: 1,
    };
    const field2: FormField = {
      id: 'f2',
      name: 'last_name',
      type: 'text',
      pageIndex: 1,
      x: 10,
      y: 50,
      width: 100,
      height: 30,
      flowOrder: 2,
    };

    const formManager = new FormManager([field1, field2]);
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

    const input1 = container.querySelector('#tspdf-field-f1') as HTMLInputElement;
    expect(input1).not.toBeNull();

    // Trigger focus and Tab keydown on input 1
    await act(async () => {
      input1.focus();
      input1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });

    expect(formManager.getActiveFieldId()).toBe('f2');

    // Trigger Shift+Tab to go back to f1
    const input2 = container.querySelector('#tspdf-field-f2') as HTMLInputElement;
    await act(async () => {
      input2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });

    expect(formManager.getActiveFieldId()).toBe('f1');
  });

  it('renders "Sign Here" flag tags and handles signing flow in Filler mode', async () => {
    const sigField: FormField = {
      id: 'sig_1',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      signatureType: 'electronic',
      signTagText: 'SIGN HERE',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 220,
      height: 60,
      roleId: 'user_a',
    };

    const formManager = new FormManager([sigField]);
    const root = createRoot(container);

    // 1. In Builder mode, verify "Sign Here" tag renders
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
          setActiveTool={vi.fn()}
          formManager={formManager}
        />
      );
    });

    expect(container.textContent).toContain('SIGN HERE');
    expect(container.textContent).toContain('E-Signature Placeholder');

    // 2. In Filler mode, verify interactive "Sign Here" tag and click opens signature modal
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

    expect(container.textContent).toContain('SIGN HERE');
    expect(container.textContent).toContain('Click to sign electronically');

    // Click signature field to open modal
    const sigBox = container.querySelector('#tspdf-field-sig_1') as HTMLDivElement;
    expect(sigBox).not.toBeNull();
    await act(async () => {
      sigBox.click();
    });

    // Verify modal appeared with adopt button
    expect(document.body.textContent).toContain('Adopt Electronic Signature');
    const adoptBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Adopt & Sign')
    );
    expect(adoptBtn).toBeDefined();

    // Now set signed value directly and check rendered signed state
    await act(async () => {
      formManager.setValue('applicant_sig', {
        type: 'electronic',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        signerName: 'Jane Smith',
        timestamp: 1700000000000,
      });
    });

    // Check signed badge and signer text
    expect(container.textContent).toContain('SIGNED');
    expect(container.textContent).toContain('Digitally signed by Jane Smith');
  });

  it('shows lock badge on signature fields assigned to other users', async () => {
    const sigField: FormField = {
      id: 'sig_b',
      name: 'executive_sig',
      label: 'Executive Signature',
      type: 'digital_signature',
      signatureType: 'digital',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 250,
      height: 60,
      roleId: 'user_b',
    };

    const formManager = new FormManager([sigField]);
    // Filling context is User A
    formManager.setCurrentRole('user_a');
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

    expect(container.textContent).toContain('User B');
    expect(container.textContent).toContain('Assigned to User B');

    // Click shouldn't open modal because it's locked for User A
    const sigBox = container.querySelector('#tspdf-field-sig_b') as HTMLDivElement;
    await act(async () => {
      sigBox?.click();
    });

    expect(document.body.textContent).not.toContain('Apply Digital Signature');
  });

  it('defaults newly drawn fields to unassigned and allows 1-click assignment via floating action bar', async () => {
    const formManager = new FormManager([]);
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
          activeTool="textbox"
          setActiveTool={setActiveTool}
          formManager={formManager}
        />
      );
    });

    const layerDiv = container.querySelector('.tspdf-form-field-layer') as HTMLDivElement;
    expect(layerDiv).not.toBeNull();

    // Simulate drag to create field with state flushing between steps
    await act(async () => {
      layerDiv.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 110, bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 110, bubbles: true }));
    });

    // Check newly created field
    const fields = formManager.getFields();
    expect(fields).toHaveLength(1);
    expect(fields[0].roleId).toBeUndefined(); // Must NOT forcibly assign to User A!

    // Field should display "Anyone" badge
    expect(container.textContent).toContain('Anyone');

    // Field should be selected, so floating action bar should show the quick assign select
    const quickAssignSelect = container.querySelector('select[title="Assign this field to a role"]') as HTMLSelectElement;
    expect(quickAssignSelect).not.toBeNull();
    expect(quickAssignSelect.value).toBe('');

    // Change assignment to User B
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      nativeSetter?.call(quickAssignSelect, 'user_b');
      quickAssignSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Verify field is now assigned to user_b and has User B's purple color
    const updatedFields = formManager.getFields();
    expect(updatedFields[0].roleId).toBe('user_b');
    expect(updatedFields[0].borderColor).toBe('#9333ea');
  });

  it('displays full role names without truncating them to User', async () => {
    const fieldA: FormField = {
      id: 'fa',
      name: 'name_a',
      label: 'Applicant Name',
      type: 'text',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 150,
      height: 40,
      roleId: 'user_a',
    };
    const fieldB: FormField = {
      id: 'fb',
      name: 'sig_b',
      label: 'Approver Signature',
      type: 'digital_signature',
      signatureType: 'digital',
      pageIndex: 1,
      x: 10,
      y: 60,
      width: 250,
      height: 60,
      roleId: 'user_b',
    };

    const formManager = new FormManager([fieldA, fieldB]);
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
          setActiveTool={vi.fn()}
          formManager={formManager}
        />
      );
    });

    // In Builder mode, fieldA should display "User A" and fieldB tag should display "(User B)"
    expect(container.textContent).toContain('User A');
    expect(container.textContent).toContain('User B');
    expect(container.textContent).toContain('(User B)');
    // Must NOT be truncated to just "User"
    expect(container.textContent).not.toMatch(/DIGITAL SIGN \(User\)/);
  });

  it('prominently displays field names, flow orders, and roles in View mode', async () => {
    const field1: FormField = {
      id: 'f1',
      name: 'applicant_name',
      label: 'Applicant Full Name',
      type: 'text',
      pageIndex: 1,
      x: 10,
      y: 30,
      width: 200,
      height: 35,
      required: true,
      flowOrder: 1,
      roleId: 'user_a',
    };
    const field2: FormField = {
      id: 'f2',
      name: 'department',
      label: 'Department',
      type: 'dropdown',
      pageIndex: 1,
      x: 10,
      y: 80,
      width: 150,
      height: 35,
      options: ['Engineering', 'Design', 'Marketing'],
      // unassigned (anyone can fill)
    };
    const field3: FormField = {
      id: 'f3',
      name: 'applicant_signature',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 10,
      y: 130,
      width: 220,
      height: 60,
      flowOrder: 2,
      roleId: 'user_a',
    };

    const formManager = new FormManager([field1, field2, field3]);
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
          showFlowOrder={true}
        />
      );
    });

    // In View mode, field labels should be prominently visible
    expect(container.textContent).toContain('Applicant Full Name');
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('User A');

    // Unassigned field should show its label and "Anyone" badge
    expect(container.textContent).toContain('Department');
    expect(container.textContent).toContain('Anyone');

    // Signature tag should show Applicant Signature with role
    expect(container.textContent).toContain('Applicant Signature (User A)');
    expect(container.textContent).toContain('#2');

    // Check that required asterisk is rendered
    expect(container.textContent).toContain('*');
  });
});




