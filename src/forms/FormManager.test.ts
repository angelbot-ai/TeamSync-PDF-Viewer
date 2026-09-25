/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect } from 'vitest';
import { FormManager } from './FormManager';
import type { FormField } from './types';

describe('FormManager', () => {
  const sampleField: FormField = {
    id: 'f1',
    name: 'user_name',
    type: 'text',
    pageIndex: 1,
    x: 100,
    y: 150,
    width: 200,
    height: 36,
    label: 'User Name',
    placeholder: 'Enter full name',
    required: true,
  };

  it('manages fields correctly and notifies listeners', () => {
    const manager = new FormManager();
    let changeCount = 0;
    manager.onFieldsChange(() => {
      changeCount++;
    });

    manager.addField(sampleField);
    expect(changeCount).toBe(1);
    expect(manager.getFields()).toHaveLength(1);
    expect(manager.getField('f1')).toBeDefined();
    expect(manager.getFieldsForPage(1)).toHaveLength(1);
    expect(manager.getFieldsForPage(2)).toHaveLength(0);

    manager.updateField('f1', { label: 'Full Legal Name' });
    expect(manager.getField('f1')?.label).toBe('Full Legal Name');
    expect(changeCount).toBe(2);

    manager.deleteField('f1');
    expect(manager.getFields()).toHaveLength(0);
    expect(changeCount).toBe(3);
  });

  it('handles undo and redo for field modifications', () => {
    const manager = new FormManager();
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(false);

    manager.addField(sampleField);
    expect(manager.canUndo).toBe(true);

    manager.undo();
    expect(manager.getFields()).toHaveLength(0);
    expect(manager.canRedo).toBe(true);

    manager.redo();
    expect(manager.getFields()).toHaveLength(1);
    expect(manager.getField('f1')?.name).toBe('user_name');
  });

  it('tracks filled form values and validates required fields', () => {
    const manager = new FormManager([sampleField]);
    let dataChangeCount = 0;
    manager.onDataChange(() => {
      dataChangeCount++;
    });

    // Currently empty: validation should fail
    const initialValidation = manager.validate();
    expect(initialValidation.valid).toBe(false);
    expect(initialValidation.errors['user_name']).toContain('User Name is required');

    // Set value: validation should pass
    manager.setValue('user_name', 'Alice Smith');
    expect(dataChangeCount).toBe(1);
    expect(manager.getValue('user_name')).toBe('Alice Smith');

    const validResult = manager.validate();
    expect(validResult.valid).toBe(true);
    expect(validResult.errors['user_name']).toBeUndefined();

    // Check checklist validation
    const checklistField: FormField = {
      id: 'f2',
      name: 'terms',
      type: 'checklist',
      pageIndex: 1,
      x: 100,
      y: 200,
      width: 200,
      height: 60,
      label: 'Terms',
      required: true,
      options: ['Accept TOS', 'Accept Privacy Policy'],
    };
    manager.addField(checklistField);

    // Empty array or missing value fails
    manager.setValue('terms', []);
    expect(manager.validate().valid).toBe(false);

    manager.setValue('terms', ['Accept TOS']);
    expect(manager.validate().valid).toBe(true);
  });

  it('migrates value if field name is updated', () => {
    const manager = new FormManager([sampleField]);
    manager.setValue('user_name', 'Bob');

    manager.updateField('f1', { name: 'full_legal_name' });
    expect(manager.getValue('user_name')).toBeUndefined();
    expect(manager.getValue('full_legal_name')).toBe('Bob');
  });

  it('exports and imports fields and values correctly', () => {
    const manager = new FormManager([sampleField], { user_name: 'Charlie' });
    const schemaJson = manager.exportFieldsJson();
    const dataJson = manager.exportDataJson();

    const newManager = new FormManager();
    expect(newManager.importFieldsJson(schemaJson)).toBe(true);
    expect(newManager.importDataJson(dataJson)).toBe(true);

    expect(newManager.getFields()).toHaveLength(1);
    expect(newManager.getValue('user_name')).toBe('Charlie');
  });
});
