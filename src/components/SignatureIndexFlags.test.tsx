/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SignatureIndexFlags } from './SignatureIndexFlags';
import { FormManager } from '../forms/FormManager';
import type { FormField } from '../forms/types';

// @ts-ignore
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('SignatureIndexFlags', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders sticky index flags for required signatures in View mode', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 50,
      assigneeId: 'user_a',
      flowOrder: 1,
    };
    const sigB: FormField = {
      id: 'sig_b',
      name: 'approver_sig',
      label: 'Executive Signature',
      type: 'digital_signature',
      pageIndex: 2,
      x: 50,
      y: 200,
      width: 220,
      height: 60,
      assigneeId: 'user_b',
      flowOrder: 2,
    };

    const formManager = new FormManager([sigA, sigB]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    // Check header and tabs
    expect(container.textContent).toContain('Signature Flags');
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('Executive Signature');
    expect(container.textContent).toContain('P.1');
    expect(container.textContent).toContain('P.2');
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('#2');
    expect(container.textContent).toContain('User A');
    expect(container.textContent).toContain('User B');
    expect(container.textContent).toContain('2 due');
  });

  it('filters sticky index flags to indicate signatures needed specifically for that user', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 50,
      assigneeId: 'user_a',
    };
    const sigB: FormField = {
      id: 'sig_b',
      name: 'approver_sig',
      label: 'Executive Signature',
      type: 'digital_signature',
      pageIndex: 2,
      x: 50,
      y: 200,
      width: 220,
      height: 60,
      assigneeId: 'user_b',
    };

    const formManager = new FormManager([sigA, sigB]);
    // Switch active user role to User A
    formManager.setCurrentAssignee('user_a');

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    // Should indicate User A's signatures
    expect(container.textContent).toContain("User A's Signatures");
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('1 due');
    // Executive Signature (User B) should not be included under User A's flags
    expect(container.textContent).not.toContain('Executive Signature');

    // Switch to User B
    await act(async () => {
      formManager.setCurrentAssignee('user_b');
    });

    expect(container.textContent).toContain("User B's Signatures");
    expect(container.textContent).toContain('Executive Signature');
    expect(container.textContent).not.toContain('Applicant Signature');
  });

  it('updates sticky flag status to SIGNED when a signature is completed', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 50,
      assigneeId: 'user_a',
    };

    const formManager = new FormManager([sigA]);
    formManager.setCurrentAssignee('user_a');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    expect(container.textContent).toContain('1 due');
    expect(container.textContent).toContain('Applicant Signature');

    // Sign the field
    await act(async () => {
      formManager.setValue('applicant_sig', {
        type: 'electronic',
        signerName: 'Jane Doe',
        timestamp: Date.now(),
      });
    });

    // Flag should update to completed signed status
    expect(container.textContent).toContain('All signed');
    expect(container.textContent).toContain('SIGNED');
  });

  it('navigates and triggers active field change when a sticky flag is clicked', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 50,
      assigneeId: 'user_a',
    };

    const formManager = new FormManager([sigA]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    const flagTab = container.querySelector('.tspdf-sticky-index-tab') as HTMLDivElement;
    expect(flagTab).not.toBeNull();

    await act(async () => {
      flagTab.click();
    });

    expect(formManager.getActiveFieldId()).toBe('sig_a');
  });

  it('allows collapsing and expanding the sticky flags dock', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 200,
      height: 50,
      assigneeId: 'user_a',
    };

    const formManager = new FormManager([sigA]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    // Find collapse button
    const collapseBtn = container.querySelector('button[title="Minimize signature flags dock"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();

    await act(async () => {
      collapseBtn.click();
    });

    // Now collapsed button should appear
    const collapsedBtn = container.querySelector('.tspdf-sticky-flags-collapsed button') as HTMLButtonElement;
    expect(collapsedBtn).not.toBeNull();
    expect(collapsedBtn.textContent).toContain('1 Sign');

    // Click to expand
    await act(async () => {
      collapsedBtn.click();
    });

    expect(container.querySelector('.tspdf-signature-index-flags')).not.toBeNull();
  });
});
