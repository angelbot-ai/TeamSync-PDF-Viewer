/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFlow.test.ts — verifies multi-user assignment, definable form fill flow, and per-user validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormManager, DEFAULT_ASSIGNEES } from './FormManager';
import type { FormField } from './types';

describe('FormManager Multi-User & Flow Flow Engine', () => {
  let formManager: FormManager;

  beforeEach(() => {
    formManager = new FormManager();
  });

  it('initializes with default assignees (User A, User B, User C)', () => {
    const assignees = formManager.getAssignees();
    expect(assignees).toHaveLength(3);
    expect(assignees.map((a) => a.id)).toEqual(['user_a', 'user_b', 'user_c']);
    expect(assignees[0].name).toContain('User A');
    expect(assignees[0].color).toBe('#2563eb');
  });

  it('allows adding and updating assignees', () => {
    formManager.addAssignee({ id: 'approver', name: 'Compliance Approver', color: '#e11d48' });
    expect(formManager.getAssignee('approver')).toBeDefined();
    expect(formManager.getAssignee('approver')?.name).toBe('Compliance Approver');
    expect(formManager.getAssignees()).toHaveLength(4);
  });

  it('resolves definable flow order and per-user flow sequence', () => {
    const fields: FormField[] = [
      {
        id: 'f1',
        name: 'user_a_field_2',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 100,
        width: 100,
        height: 30,
        assigneeId: 'user_a',
        flowOrder: 2,
      },
      {
        id: 'f2',
        name: 'user_b_field_1',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 200,
        width: 100,
        height: 30,
        assigneeId: 'user_b',
        flowOrder: 1,
      },
      {
        id: 'f3',
        name: 'user_a_field_1',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 50,
        width: 100,
        height: 30,
        assigneeId: 'user_a',
        flowOrder: 1,
      },
      {
        id: 'f4',
        name: 'user_b_field_2',
        type: 'text',
        pageIndex: 2,
        x: 10,
        y: 50,
        width: 100,
        height: 30,
        assigneeId: 'user_b',
        flowOrder: 2,
      },
    ];

    formManager.setFields(fields);

    // Global flow order
    const allFlow = formManager.getFlowFields(null);
    expect(allFlow.map((f) => f.id)).toEqual(['f2', 'f3', 'f1', 'f4']);

    // User A specific flow: f3 (order 1) then f1 (order 2)
    const userAFlow = formManager.getFlowFields('user_a');
    expect(userAFlow.map((f) => f.id)).toEqual(['f3', 'f1']);

    // User B specific flow: f2 (order 1) then f4 (order 2)
    const userBFlow = formManager.getFlowFields('user_b');
    expect(userBFlow.map((f) => f.id)).toEqual(['f2', 'f4']);
  });

  it('navigates next and previous fields within active user flow', () => {
    const fields: FormField[] = [
      {
        id: 'a1',
        name: 'name_a',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 30,
        assigneeId: 'user_a',
        flowOrder: 1,
      },
      {
        id: 'b1',
        name: 'name_b',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 50,
        width: 100,
        height: 30,
        assigneeId: 'user_b',
        flowOrder: 1,
      },
      {
        id: 'a2',
        name: 'signature_a',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 90,
        width: 100,
        height: 30,
        assigneeId: 'user_a',
        flowOrder: 2,
      },
    ];

    formManager.setFields(fields);
    formManager.setCurrentAssignee('user_a');

    // Start with no active field -> goToNextField picks first field of user A
    const first = formManager.goToNextField();
    expect(first?.id).toBe('a1');
    expect(formManager.getActiveFieldId()).toBe('a1');

    // Advance to next -> skips b1 and goes directly to a2
    const second = formManager.goToNextField();
    expect(second?.id).toBe('a2');
    expect(formManager.getActiveFieldId()).toBe('a2');

    // Advance to next -> loops back around to a1
    const wrapped = formManager.goToNextField();
    expect(wrapped?.id).toBe('a1');

    // Previous field -> loops back to a2
    const prev = formManager.goToPreviousField();
    expect(prev?.id).toBe('a2');
  });

  it('performs per-user validation respecting the active assignee context', () => {
    const fields: FormField[] = [
      {
        id: 'req_a',
        name: 'contract_title',
        label: 'Contract Title',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 30,
        required: true,
        assigneeId: 'user_a',
      },
      {
        id: 'req_b',
        name: 'approval_signature',
        label: 'Approval Signature',
        type: 'text',
        pageIndex: 1,
        x: 10,
        y: 50,
        width: 100,
        height: 30,
        required: true,
        assigneeId: 'user_b',
      },
    ];

    formManager.setFields(fields);

    // When validated as User A with nothing filled:
    // Only contract_title is flagged, approval_signature (User B's field) is NOT flagged
    formManager.setCurrentAssignee('user_a');
    const resA1 = formManager.validate();
    expect(resA1.valid).toBe(false);
    expect(resA1.errors['contract_title']).toBeDefined();
    expect(resA1.errors['approval_signature']).toBeUndefined();

    // User A fills contract_title
    formManager.setValue('contract_title', 'Master Service Agreement 2026');
    const resA2 = formManager.validate();
    expect(resA2.valid).toBe(true);

    // When validated as User B:
    formManager.setCurrentAssignee('user_b');
    const resB1 = formManager.validate();
    expect(resB1.valid).toBe(false);
    expect(resB1.errors['approval_signature']).toBeDefined();

    // When validated as Admin / All (no assignee filter):
    const resAll = formManager.validate(null);
    expect(resAll.valid).toBe(false);
    expect(resAll.errors['approval_signature']).toBeDefined();
    expect(resAll.errors['contract_title']).toBeUndefined();
  });

  it('exports and imports schema preserving custom styling and assignees', () => {
    const customField: FormField = {
      id: 'styled_1',
      name: 'styled_field',
      type: 'text',
      pageIndex: 1,
      x: 20,
      y: 30,
      width: 150,
      height: 40,
      textColor: '#dc2626',
      backgroundColor: '#fef2f2',
      borderColor: '#ef4444',
      borderWidth: 2,
      borderRadius: 6,
      fontFamily: 'serif',
      fontSize: 16,
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      assigneeId: 'user_b',
      flowOrder: 5,
    };

    formManager.setFields([customField]);
    const json = formManager.exportFieldsJson();

    const newManager = new FormManager();
    const imported = newManager.importFieldsJson(json);
    expect(imported).toBe(true);

    const importedFields = newManager.getFields();
    expect(importedFields).toHaveLength(1);
    const f = importedFields[0];
    expect(f.textColor).toBe('#dc2626');
    expect(f.backgroundColor).toBe('#fef2f2');
    expect(f.borderColor).toBe('#ef4444');
    expect(f.borderWidth).toBe(2);
    expect(f.borderRadius).toBe(6);
    expect(f.fontFamily).toBe('serif');
    expect(f.fontSize).toBe(16);
    expect(f.fontWeight).toBe('bold');
    expect(f.fontStyle).toBe('italic');
    expect(f.textAlign).toBe('center');
    expect(f.assigneeId).toBe('user_b');
    expect(f.flowOrder).toBe(5);
  });
});
