/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormSignatureModal.test.tsx — unit tests for Electronic and Digital signature modal.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { FormSignatureModal } from './FormSignatureModal';
import type { FormField, FormRole, FormSignatureValue } from '../forms/types';

describe('FormSignatureModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const testField: FormField = {
    id: 'sig_test',
    name: 'test_signature',
    label: 'Applicant Signature',
    type: 'signature',
    signatureType: 'electronic',
    signTagText: 'SIGN HERE',
    pageIndex: 1,
    x: 50,
    y: 50,
    width: 200,
    height: 60,
    roleId: 'user_a',
  };

  const testRole: FormRole = {
    id: 'user_a',
    name: 'Jane Doe',
    color: '#2563eb',
  };

  it('renders modal with pointerEvents auto and electronic drawing tab', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormSignatureModal
          field={testField}
          role={testRole}
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('Adopt Electronic Signature');
    expect(container.textContent).toContain('Applicant Signature');
    expect(container.textContent).toContain('Draw your signature above the line');

    // Verify pointerEvents: auto on overlay and modal card
    const modalBackdrop = container.firstElementChild as HTMLDivElement;
    expect(modalBackdrop).not.toBeNull();
    expect(modalBackdrop.style.pointerEvents).toBe('auto');

    const modalDialog = modalBackdrop.firstElementChild as HTMLDivElement;
    expect(modalDialog.style.pointerEvents).toBe('auto');
  });

  it('supports typing signature and adopting', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormSignatureModal
          field={testField}
          role={testRole}
          defaultSignerName="Jane Doe"
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    // Click "Type" tab
    const typeTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Type')
    );
    expect(typeTabBtn).toBeDefined();

    await act(async () => {
      typeTabBtn?.click();
    });

    expect(container.textContent).toContain('Select a handwriting style:');

    // Adopt and sign
    const adoptBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Adopt & Sign')
    );
    expect(adoptBtn).toBeDefined();

    await act(async () => {
      adoptBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'electronic',
        signerName: 'Jane Doe',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('supports digital certificate signature adoption with SHA-256 seal', async () => {
    const digitalField: FormField = {
      ...testField,
      type: 'digital_signature',
      signatureType: 'digital',
    };
    const onSave = vi.fn();
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormSignatureModal
          field={digitalField}
          role={testRole}
          defaultSignerName="Officer Smith"
          onSave={onSave}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('Apply Digital Signature');
    expect(container.textContent).toContain('Digitally signed by Officer Smith');
    expect(container.textContent).toContain('SHA-256:');

    // Adopt digital sign
    const signBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Digitally Sign')
    );
    expect(signBtn).toBeDefined();

    await act(async () => {
      signBtn?.click();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'digital',
        signerName: 'Officer Smith',
        reason: 'Document Approval',
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
