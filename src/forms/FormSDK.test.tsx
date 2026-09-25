/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormSDK.test.ts — Unit tests for programmatic SDK form control, user assignment,
 * and feature visibility configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormManager, DEFAULT_FORM_OPTIONS } from './FormManager';
import { WebViewerInstance } from '../core/ViewerInstance';
import { ViewerBus } from '../core/eventBus';
import { AnnotationManager } from '../annotations/AnnotationManager';
import { FormFillerActions } from '../components/FormFillerActions';
import { SignatureIndexFlags } from '../components/SignatureIndexFlags';
import { FormFieldLayer } from '../components/FormFieldLayer';
import type { FormField, FormAssignee, FormFeatureOptions } from './types';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Form SDK & Programmatic Feature Control', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const sampleFields: FormField[] = [
    {
      id: 'field_user_a',
      name: 'applicant_name',
      label: 'Applicant Name',
      type: 'text',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 40,
      assigneeId: 'user_a',
      flowOrder: 1,
    },
    {
      id: 'field_user_b',
      name: 'reviewer_notes',
      label: 'Reviewer Notes',
      type: 'textarea',
      pageIndex: 1,
      x: 50,
      y: 160,
      width: 200,
      height: 60,
      assigneeId: 'user_b',
      flowOrder: 2,
    },
    {
      id: 'sig_user_a',
      name: 'applicant_signature',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 2,
      x: 50,
      y: 300,
      width: 200,
      height: 60,
      assigneeId: 'user_a',
      flowOrder: 3,
    },
    {
      id: 'sig_user_b',
      name: 'executive_signature',
      label: 'Executive Signature',
      type: 'digital_signature',
      pageIndex: 2,
      x: 50,
      y: 400,
      width: 200,
      height: 60,
      assigneeId: 'user_b',
      flowOrder: 4,
    },
  ];

  it('initializes with default options and allows reading and updating options', () => {
    const formManager = new FormManager(sampleFields);
    expect(formManager.getOptions()).toEqual(DEFAULT_FORM_OPTIONS);

    formManager.setOptions({ allowUserSwitching: false, showSignatureFlags: false });
    expect(formManager.getOptions().allowUserSwitching).toBe(false);
    expect(formManager.getOptions().showSignatureFlags).toBe(false);
    expect(formManager.getOptions().showFlowNavigation).toBe(true);
  });

  it('allows programmatically setting a user via setUser() and auto-registers assignees', () => {
    const formManager = new FormManager(sampleFields);

    // Set by string ID
    formManager.setUser('user_a');
    expect(formManager.getCurrentAssignee()).toBe('user_a');
    expect(formManager.getUser()?.name).toBe('User A');

    // Set by custom user object
    formManager.setUser({ id: 'user_custom', name: 'External Client', color: '#e11d48' });
    expect(formManager.getCurrentAssignee()).toBe('user_custom');
    const user = formManager.getUser();
    expect(user?.name).toBe('External Client');
    expect(user?.color).toBe('#e11d48');
    expect(formManager.getAssignees().some((a) => a.id === 'user_custom')).toBe(true);

    // Clear user
    formManager.setUser(null);
    expect(formManager.getCurrentAssignee()).toBeNull();
    expect(formManager.getUser()).toBeUndefined();
  });

  it('exposes full Form SDK methods on WebViewerInstance', () => {
    const bus = new ViewerBus();
    const annManager = new AnnotationManager();
    const formManager = new FormManager(sampleFields);
    const instance = new WebViewerInstance(bus, annManager, 'test-viewer', formManager);

    // Test form user methods
    instance.setFormUser({ id: 'user_tenant', name: 'Tenant Signer' });
    expect(instance.getFormUser()?.name).toBe('Tenant Signer');
    expect(instance.getCurrentFormAssignee()).toBe('user_tenant');

    // Test form options methods
    instance.setFormOptions({
      allowUserSwitching: false,
      otherUserFieldsMode: 'hidden',
    });
    const opts = instance.getFormOptions();
    expect(opts.allowUserSwitching).toBe(false);
    expect(opts.otherUserFieldsMode).toBe('hidden');

    // Test schema and data methods
    expect(instance.getFormFields().length).toBe(4);
    instance.setFormData({ applicant_name: 'John Doe' });
    expect(instance.getFormData()).toEqual({ applicant_name: 'John Doe' });
    instance.clearFormData();
    expect(instance.getFormData()).toEqual({});
  });

  it('locks user persona selector when allowUserSwitching is false in FormFillerActions', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setUser('user_a');
    formManager.setOptions({ allowUserSwitching: false });

    const root = createRoot(container);
    await act(async () => {
      root.render(<FormFillerActions formManager={formManager} />);
    });

    // The user should see User A locked without an editable dropdown
    expect(container.textContent).toContain('Filling as:');
    expect(container.textContent).toContain('User A');
    expect(container.querySelector('select')).toBeNull();

    // Now re-enable user switching
    await act(async () => {
      formManager.setOptions({ allowUserSwitching: true });
    });

    expect(container.querySelector('select')).not.toBeNull();
  });

  it('hides the entire toolbar when hideToolbar option is true in FormFillerActions', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setOptions({ hideToolbar: true });

    const root = createRoot(container);
    await act(async () => {
      root.render(<FormFillerActions formManager={formManager} />);
    });

    expect(container.textContent).toBe('');
  });

  it('selectively hides individual filler toolbar features based on formOptions', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setOptions({
      showFlowNavigation: false,
      showValidation: false,
      showReset: false,
      showExport: false,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FormFillerActions
          formManager={formManager}
          onDownloadFilledPdf={() => {}}
        />
      );
    });

    expect(container.textContent).not.toContain('Step 1 of');
    expect(container.textContent).not.toContain('Validate');
    expect(container.textContent).not.toContain('Export JSON');
    expect(container.textContent).not.toContain('Download PDF');
    expect(container.textContent).not.toContain('Reset');
  });

  it('controls signature flags visibility via showSignatureFlags option', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setUser('user_a');

    const root = createRoot(container);
    await act(async () => {
      root.render(<SignatureIndexFlags formManager={formManager} activeTab="View" />);
    });

    // Should be visible initially
    expect(container.querySelector('.tspdf-signature-index-flags')).not.toBeNull();

    // Disable signature flags
    await act(async () => {
      formManager.setOptions({ showSignatureFlags: false });
    });

    expect(container.querySelector('.tspdf-signature-index-flags')).toBeNull();
  });

  it('hides other users fields when otherUserFieldsMode is hidden in FormFieldLayer', async () => {
    const formManager = new FormManager(sampleFields);
    // User A is active
    formManager.setUser('user_a');
    formManager.setOptions({ otherUserFieldsMode: 'hidden' });

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
          setActiveTool={() => {}}
          formManager={formManager}
        />
      );
    });

    // User A's field is rendered
    expect(container.textContent).toContain('Applicant Name');
    // User B's field is completely omitted/hidden from view
    expect(container.textContent).not.toContain('Reviewer Notes');
  });

  it('disables lock badge when otherUserFieldsMode is view-only in FormFieldLayer', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setUser('user_a');
    formManager.setOptions({ otherUserFieldsMode: 'view-only' });

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
          setActiveTool={() => {}}
          formManager={formManager}
        />
      );
    });

    // Both fields are rendered, but other user field does not show lock icon
    expect(container.textContent).toContain('Applicant Name');
    expect(container.textContent).toContain('Reviewer Notes');
    expect(container.querySelector('svg.lucide-lock')).toBeNull();
  });
});
