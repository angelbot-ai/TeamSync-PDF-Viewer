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
import { FormSignatureModal } from '../components/FormSignatureModal';
import type { FormField, FormRole, FormFeatureOptions } from './types';
import type { ViewerUser } from '../core/types';

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
      roleId: 'user_a',
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
      roleId: 'user_b',
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
      roleId: 'user_a',
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
      roleId: 'user_b',
      flowOrder: 4,
    },
  ];

  it('initializes with default options and allows reading and updating options', () => {
    const formManager = new FormManager(sampleFields);
    expect(formManager.getOptions()).toEqual(DEFAULT_FORM_OPTIONS);

    formManager.setOptions({ allowRoleSwitching: false, showSignatureFlags: false });
    expect(formManager.getOptions().allowRoleSwitching).toBe(false);
    expect(formManager.getOptions().showSignatureFlags).toBe(false);
    expect(formManager.getOptions().showFlowNavigation).toBe(true);
  });

  it('allows programmatically setting role via setCurrentRole() and user via setCurrentUser()', () => {
    const formManager = new FormManager(sampleFields);

    // Set active role by ID
    formManager.setCurrentRole('user_a');
    expect(formManager.getCurrentRole()).toBe('user_a');
    expect(formManager.getRole('user_a')?.name).toBe('User A');

    // Set current user
    formManager.setCurrentUser({ id: 'usr_1', name: 'External Client', color: '#e11d48' });
    expect(formManager.getCurrentUser()?.name).toBe('External Client');
    expect(formManager.getCurrentUser()?.color).toBe('#e11d48');

    // Clear role and user
    formManager.setCurrentRole(null);
    formManager.setCurrentUser(null);
    expect(formManager.getCurrentRole()).toBeNull();
    expect(formManager.getCurrentUser()).toBeNull();
  });

  it('exposes full Form SDK methods on WebViewerInstance', () => {
    const bus = new ViewerBus();
    const annManager = new AnnotationManager();
    const formManager = new FormManager(sampleFields);
    const instance = new WebViewerInstance(bus, annManager, 'test-viewer', formManager);

    // Test current user methods
    instance.setCurrentUser({ id: 'user_tenant', name: 'Tenant Signer', role: 'user_a' });
    expect(instance.getCurrentUser()?.name).toBe('Tenant Signer');
    expect(instance.getCurrentRole()).toBe('user_a');

    // Test form options methods
    instance.setFormOptions({
      allowRoleSwitching: false,
      otherRoleFieldsMode: 'hidden',
    });
    const opts = instance.getFormOptions();
    expect(opts.allowRoleSwitching).toBe(false);
    expect(opts.otherRoleFieldsMode).toBe('hidden');

    // Test schema and data methods
    expect(instance.getFormFields().length).toBe(4);
    instance.setFormData({ applicant_name: 'John Doe' });
    expect(instance.getFormData()).toEqual({ applicant_name: 'John Doe' });
    instance.clearFormData();
    expect(instance.getFormData()).toEqual({});
  });

  it('locks role selector when allowRoleSwitching is false in FormFillerActions', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setCurrentRole('user_a');
    formManager.setOptions({ allowRoleSwitching: false });

    const root = createRoot(container);
    await act(async () => {
      root.render(<FormFillerActions formManager={formManager} />);
    });

    // The user should see User A locked without an editable dropdown
    expect(container.textContent).toContain('Filling as:');
    expect(container.textContent).toContain('User A');
    expect(container.querySelector('select')).toBeNull();

    // Now re-enable role switching
    await act(async () => {
      formManager.setOptions({ allowRoleSwitching: true });
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
    formManager.setCurrentRole('user_a');

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

  it('hides other roles fields when otherRoleFieldsMode is hidden in FormFieldLayer', async () => {
    const formManager = new FormManager(sampleFields);
    // User A is active
    formManager.setCurrentRole('user_a');
    formManager.setOptions({ otherRoleFieldsMode: 'hidden' });

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

  it('disables lock badge when otherRoleFieldsMode is view-only in FormFieldLayer', async () => {
    const formManager = new FormManager(sampleFields);
    formManager.setCurrentRole('user_a');
    formManager.setOptions({ otherRoleFieldsMode: 'view-only' });

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

  it('correctly distinguishes template roles from current user passed by application', () => {
    const templateRoles: FormRole[] = [
      { id: 'tenant', name: 'Tenant', color: '#2563eb' },
      { id: 'landlord', name: 'Landlord', color: '#10b981' },
    ];
    const formManager = new FormManager(sampleFields, {}, templateRoles);

    // Initial state: template roles are set, no current user yet
    expect(formManager.getRoles().length).toBe(2);
    expect(formManager.getCurrentUser()).toBeNull();
    expect(formManager.getEffectiveSignerName()).toBe('');

    // Host application passes current user details fulfilling the 'tenant' role
    const currentUser: ViewerUser = {
      id: 'usr_abc123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'tenant',
    };

    formManager.setCurrentUser(currentUser);

    // Verify role mapping and current user details
    expect(formManager.getCurrentUser()).toEqual(currentUser);
    expect(formManager.getCurrentRole()).toBe('tenant');
    expect(formManager.getEffectiveSignerName()).toBe('John Doe');

    // Verify that template roles were not mutated with random user IDs
    expect(formManager.getRoles().map((r) => r.id)).toEqual(['tenant', 'landlord']);
    expect(formManager.getRoles().some((r) => r.id === 'usr_abc123')).toBe(false);
  });

  it('exposes role and current user methods on WebViewerInstance', () => {
    const bus = new ViewerBus();
    const annManager = new AnnotationManager();
    const templateRoles: FormRole[] = [
      { id: 'applicant', name: 'Applicant', color: '#2563eb' },
      { id: 'reviewer', name: 'Reviewer', color: '#9333ea' },
    ];
    const formManager = new FormManager(sampleFields, {}, templateRoles);
    const instance = new WebViewerInstance(bus, annManager, 'test-viewer', formManager);

    // Set current user via instance
    instance.setCurrentUser({
      id: 'usr_xyz',
      name: 'Alice Johnson',
      email: 'alice@company.com',
      role: 'reviewer',
    });

    expect(instance.getCurrentUser()?.name).toBe('Alice Johnson');
    expect(instance.getCurrentUser()?.email).toBe('alice@company.com');
    expect(instance.getCurrentRole()).toBe('reviewer');

    // Switch role programmatically
    instance.setCurrentRole('applicant');
    expect(instance.getCurrentRole()).toBe('applicant');

    // Roles list
    expect(instance.getFormRoles().length).toBe(2);
  });

  it('displays current user name and role badge cleanly in FormFillerActions', async () => {
    const templateRoles: FormRole[] = [
      { id: 'tenant', name: 'Tenant', color: '#2563eb' },
      { id: 'landlord', name: 'Landlord', color: '#10b981' },
    ];
    const formManager = new FormManager(sampleFields, {}, templateRoles);
    formManager.setCurrentUser({
      id: 'usr_99',
      name: 'Robert Davis',
      email: 'robert@domain.com',
      role: 'tenant',
    });
    formManager.setOptions({ allowRoleSwitching: false });

    const root = createRoot(container);
    await act(async () => {
      root.render(<FormFillerActions formManager={formManager} />);
    });

    // Shows current user name "Robert Davis" and locked role badge "(Tenant)"
    expect(container.textContent).toContain('Filling as:');
    expect(container.textContent).toContain('Robert Davis');
    expect(container.textContent).toContain('(Tenant)');
    expect(container.querySelector('select')).toBeNull();

    // Enable role switching: Robert Davis remains the user, but role selector dropdown is rendered
    await act(async () => {
      formManager.setOptions({ allowRoleSwitching: true });
    });

    expect(container.textContent).toContain('Robert Davis');
    const select = container.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('tenant');
  });

  it('defaults signature modal signer name to current user and records email and role on save', async () => {
    const templateRole: FormRole = { id: 'applicant', name: 'Applicant', color: '#2563eb' };
    const currentUser: ViewerUser = {
      id: 'usr_42',
      name: 'Sarah Connor',
      email: 'sarah@resistance.org',
      role: 'applicant',
    };

    const sigField: FormField = {
      id: 'sig_field',
      name: 'signature',
      label: 'Sign Here',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 60,
      roleId: 'applicant',
    };

    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormSignatureModal
          field={sigField}
          role={templateRole}
          currentUser={currentUser}
          defaultSignerName={currentUser.name}
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    // Header shows Role: Applicant and Signer: Sarah Connor (sarah@resistance.org)
    expect(container.textContent).toContain('Role: Applicant');
    expect(container.textContent).toContain('Signer: Sarah Connor');
    expect(container.textContent).toContain('User session: Sarah Connor');

    // Switch to "Type" tab and adopt
    const typeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Type')
    );
    await act(async () => {
      typeBtn?.click();
    });

    const adoptBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Adopt & Sign')
    );
    await act(async () => {
      adoptBtn?.click();
    });

    // onSave received current user details
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'electronic',
        signerName: 'Sarah Connor',
        signerEmail: 'sarah@resistance.org',
        signerRole: 'Applicant',
      })
    );
  });
});
