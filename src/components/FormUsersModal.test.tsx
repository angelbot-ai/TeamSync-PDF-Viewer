/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormUsersModal.test.tsx — unit tests for the FormUsersModal component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { FormUsersModal } from './FormUsersModal';
import { FormManager } from '../forms/FormManager';
import type { FormField } from '../forms/types';

describe('FormUsersModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders existing default form users and their field counts', async () => {
    const fields: FormField[] = [
      {
        id: 'f1',
        name: 'field_1',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 30,
        roleId: 'user_a',
      },
    ];
    const formManager = new FormManager(fields);
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormUsersModal
          formManager={formManager}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('Form Users & Roles');
    expect(container.textContent).toContain('User A');
    expect(container.textContent).toContain('1 field');
    expect(container.textContent).toContain('0 fields');
  });

  it('allows adding a new user with a custom name and color', async () => {
    const formManager = new FormManager();
    const onClose = vi.fn();
    const onUserAdded = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormUsersModal
          formManager={formManager}
          onClose={onClose}
          onUserAdded={onUserAdded}
        />
      );
    });

    const nameInput = container.querySelector('input[placeholder*="Tenant, Inspector"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(nameInput, 'Legal Counsel');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Add User'));
    expect(addBtn).not.toBeNull();

    await act(async () => {
      addBtn?.click();
    });

    expect(container.textContent).toContain('Legal Counsel');
    expect(onUserAdded).toHaveBeenCalled();
    expect(formManager.getRoles().some((a) => a.name === 'Legal Counsel')).toBe(true);
  });

  it('prevents adding a user with an empty or duplicate name', async () => {
    const formManager = new FormManager();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormUsersModal
          formManager={formManager}
          onClose={vi.fn()}
        />
      );
    });

    const addBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Add User'));

    // Attempt adding empty name
    await act(async () => {
      addBtn?.click();
    });

    expect(container.textContent).toContain('Please enter a role name');

    // Attempt adding duplicate name
    const nameInput = container.querySelector('input[placeholder*="Tenant, Inspector"]') as HTMLInputElement;
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(nameInput, 'User A');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      addBtn?.click();
    });

    expect(container.textContent).toContain('already exists');
  });

  it('allows removing an existing user and unassigning their fields', async () => {
    const field: FormField = {
      id: 'f_test',
      name: 'field_test',
      type: 'text',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 100,
      height: 30,
      roleId: 'user_c',
    };
    const formManager = new FormManager([field]);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormUsersModal
          formManager={formManager}
          onClose={vi.fn()}
        />
      );
    });

    expect(formManager.getRoles().some((a) => a.id === 'user_c')).toBe(true);

    // Call formManager.removeRole directly or trigger delete button
    await act(async () => {
      formManager.removeRole('user_c');
    });

    expect(formManager.getRoles().some((a) => a.id === 'user_c')).toBe(false);
    expect(formManager.getField('f_test')?.roleId).toBeUndefined();
  });
});
