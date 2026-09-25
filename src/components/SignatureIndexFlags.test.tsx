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

  it('renders nothing when no user is selected', async () => {
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
    // No current assignee set — dock should not render
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SignatureIndexFlags
          formManager={formManager}
          activeTab="View"
        />
      );
    });

    // Nothing should render because no user is selected
    expect(container.textContent).toBe('');
    expect(container.querySelector('.tspdf-signature-index-flags')).toBeNull();
  });

  it('shows only the current user\'s signature flags when a user is selected', async () => {
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

    // Should show User A's name in the header and their signature
    expect(container.textContent).toContain('User A');
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('Page 1');

    // User B's signature should NOT be visible
    expect(container.textContent).not.toContain('Executive Signature');

    // Switch to User B
    await act(async () => {
      formManager.setCurrentAssignee('user_b');
    });

    expect(container.textContent).toContain('User B');
    expect(container.textContent).toContain('Executive Signature');
    expect(container.textContent).not.toContain('Applicant Signature');
  });

  it('updates status when a signature is completed', async () => {
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

    // Should show "0/1" progress (pending)
    expect(container.textContent).toContain('0/1');

    // Sign the field
    await act(async () => {
      formManager.setValue('applicant_sig', {
        type: 'electronic',
        signerName: 'Jane Doe',
        timestamp: Date.now(),
      });
    });

    // Should update to "All done"
    expect(container.textContent).toContain('All done');
    expect(container.textContent).toContain('✓');
  });

  it('navigates and triggers active field change when a flag is clicked', async () => {
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

    // Find collapse button
    const collapseBtn = container.querySelector('button[title="Minimize"]') as HTMLButtonElement;
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
