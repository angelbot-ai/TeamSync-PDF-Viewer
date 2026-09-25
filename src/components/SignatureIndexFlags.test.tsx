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

  it('renders sticky index flags on the side so signatures on page 2 are visible while viewing page 1', async () => {
    const sigOnPage2: FormField = {
      id: 'sig_p2',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 2,
      x: 60,
      y: 400,
      width: 220,
      height: 60,
      assigneeId: 'user_a',
      flowOrder: 1,
    };

    const formManager = new FormManager([sigOnPage2]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    // The sticky index flag for the Page 2 signature must be rendered on the side
    expect(container.querySelector('.tspdf-signature-index-flags')).not.toBeNull();
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('P.2');
    expect(container.textContent).toContain('1 due');
  });

  it('shows only the current user\'s signature flags when a specific user is selected', async () => {
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

    // Should show User A's name in the header and their signature on Page 1
    expect(container.textContent).toContain('User A');
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('P.1');

    // User B's signature on Page 2 should NOT be visible when viewing as User A
    expect(container.textContent).not.toContain('Executive Signature');

    // Switch to User B
    await act(async () => {
      formManager.setCurrentAssignee('user_b');
    });

    expect(container.textContent).toContain('User B');
    expect(container.textContent).toContain('Executive Signature');
    expect(container.textContent).toContain('P.2');
    expect(container.textContent).not.toContain('Applicant Signature');
  });

  it('updates status when a signature is completed', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 2,
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

    // 1 pending due
    expect(container.textContent).toContain('1 due');

    // Sign the field
    await act(async () => {
      formManager.setValue('applicant_sig', {
        type: 'electronic',
        signerName: 'Jane Doe',
        timestamp: Date.now(),
      });
    });

    // Should update to completed status
    expect(container.textContent).toContain('All signed');
    expect(container.textContent).toContain('SIGNED');
  });

  it('navigates and triggers active field change when a flag is clicked', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 2,
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

    const flagTab = container.querySelector('.tspdf-sticky-index-tab') as HTMLDivElement;
    expect(flagTab).not.toBeNull();

    await act(async () => {
      flagTab.click();
    });

    expect(formManager.getActiveFieldId()).toBe('sig_a');
  });

  it('allows collapsing and expanding the dock', async () => {
    const sigA: FormField = {
      id: 'sig_a',
      name: 'applicant_sig',
      label: 'Applicant Signature',
      type: 'signature',
      pageIndex: 2,
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

    // Find collapse button
    const collapseBtn = container.querySelector('button[title="Minimize signature flags dock"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();

    await act(async () => {
      collapseBtn.click();
    });

    // Collapsed pill should appear
    const collapsedBtn = container.querySelector('.tspdf-sticky-flags-collapsed button') as HTMLButtonElement;
    expect(collapsedBtn).not.toBeNull();
    expect(collapsedBtn.textContent).toContain('1 to sign');

    // Click to expand
    await act(async () => {
      collapsedBtn.click();
    });

    expect(container.querySelector('.tspdf-signature-index-flags')).not.toBeNull();
  });
});
