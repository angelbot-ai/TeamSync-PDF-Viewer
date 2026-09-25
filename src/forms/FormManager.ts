/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormManager — central state manager for PDF forms builder schema and form filler data.
 */

import type { FormField, FormDataRecord, FormValidationResult } from './types';

export interface FormFieldsChangeEvent {
  fields: FormField[];
  action: 'add' | 'update' | 'delete' | 'set' | 'clear';
}

export type FormFieldsChangeListener = (event: FormFieldsChangeEvent) => void;
export type FormDataChangeListener = (data: FormDataRecord) => void;

interface HistorySnapshot {
  fields: FormField[];
}

const MAX_HISTORY = 100;

export class FormManager {
  private fields: FormField[] = [];
  private values: FormDataRecord = {};
  private past: HistorySnapshot[] = [];
  private future: HistorySnapshot[] = [];
  private fieldsListeners = new Set<FormFieldsChangeListener>();
  private dataListeners = new Set<FormDataChangeListener>();
  private readOnly = false;

  constructor(initialFields: FormField[] = [], initialValues: FormDataRecord = {}) {
    this.fields = [...initialFields];
    this.values = { ...initialValues };
  }

  // ---- Subscriptions -----------------------------------------------------------------------

  onFieldsChange(listener: FormFieldsChangeListener): () => void {
    this.fieldsListeners.add(listener);
    return () => this.fieldsListeners.delete(listener);
  }

  onDataChange(listener: FormDataChangeListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  private notifyFieldsChange(action: FormFieldsChangeEvent['action']): void {
    const event: FormFieldsChangeEvent = {
      fields: this.getFields(),
      action,
    };
    for (const listener of this.fieldsListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in FormManager fields listener:', err);
      }
    }
  }

  private notifyDataChange(): void {
    const data = this.getValues();
    for (const listener of this.dataListeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('Error in FormManager data listener:', err);
      }
    }
  }

  // ---- Undo / Redo for Builder -------------------------------------------------------------

  private pushHistory(): void {
    this.past.push({ fields: JSON.parse(JSON.stringify(this.fields)) });
    if (this.past.length > MAX_HISTORY) {
      this.past.shift();
    }
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const prev = this.past.pop()!;
    this.future.push({ fields: JSON.parse(JSON.stringify(this.fields)) });
    this.fields = prev.fields;
    this.notifyFieldsChange('set');
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    const next = this.future.pop()!;
    this.past.push({ fields: JSON.parse(JSON.stringify(this.fields)) });
    this.fields = next.fields;
    this.notifyFieldsChange('set');
    return true;
  }

  // ---- Field Schema Management (Builder) ---------------------------------------------------

  getFields(): FormField[] {
    return [...this.fields];
  }

  getFieldsForPage(pageIndex: number): FormField[] {
    return this.fields.filter((f) => f.pageIndex === pageIndex);
  }

  getField(id: string): FormField | undefined {
    return this.fields.find((f) => f.id === id);
  }

  setFields(newFields: FormField[], recordHistory = true): void {
    if (recordHistory) this.pushHistory();
    this.fields = [...newFields];
    this.notifyFieldsChange('set');
  }

  addField(field: FormField, recordHistory = true): void {
    if (recordHistory) this.pushHistory();
    this.fields.push({ ...field });
    // Initialize default value if present and no active value set
    if (field.defaultValue !== undefined && this.values[field.name] === undefined) {
      this.values[field.name] = field.defaultValue;
      this.notifyDataChange();
    }
    this.notifyFieldsChange('add');
  }

  updateField(id: string, updates: Partial<FormField>, recordHistory = true): void {
    const idx = this.fields.findIndex((f) => f.id === id);
    if (idx === -1) return;
    if (recordHistory) this.pushHistory();

    const oldName = this.fields[idx].name;
    const updated = { ...this.fields[idx], ...updates };
    this.fields[idx] = updated;

    // If field name changed, migrate stored value
    if (updates.name && updates.name !== oldName) {
      if (this.values[oldName] !== undefined) {
        this.values[updates.name] = this.values[oldName];
        delete this.values[oldName];
        this.notifyDataChange();
      }
    }

    this.notifyFieldsChange('update');
  }

  deleteField(id: string, recordHistory = true): void {
    const field = this.fields.find((f) => f.id === id);
    if (!field) return;
    if (recordHistory) this.pushHistory();

    this.fields = this.fields.filter((f) => f.id !== id);
    this.notifyFieldsChange('delete');
  }

  clearFields(recordHistory = true): void {
    if (this.fields.length === 0) return;
    if (recordHistory) this.pushHistory();
    this.fields = [];
    this.notifyFieldsChange('clear');
  }

  // ---- Form Values Management (Filler) -----------------------------------------------------

  getValues(): FormDataRecord {
    return { ...this.values };
  }

  getValue(name: string): any {
    return this.values[name];
  }

  setValue(name: string, value: any): void {
    if (this.readOnly) return;
    this.values[name] = value;
    this.notifyDataChange();
  }

  setValues(newValues: FormDataRecord): void {
    if (this.readOnly) return;
    this.values = { ...newValues };
    this.notifyDataChange();
  }

  clearValues(): void {
    if (this.readOnly) return;
    this.values = {};
    this.notifyDataChange();
  }

  resetToDefaults(): void {
    if (this.readOnly) return;
    const defaults: FormDataRecord = {};
    for (const field of this.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    }
    this.values = defaults;
    this.notifyDataChange();
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }

  // ---- Validation --------------------------------------------------------------------------

  validate(): FormValidationResult {
    const errors: Record<string, string> = {};

    for (const field of this.fields) {
      if (!field.required) continue;

      const val = this.values[field.name];
      const displayName = field.label || field.name;

      if (val === undefined || val === null || val === '') {
        errors[field.name] = `${displayName} is required`;
      } else if (field.type === 'checklist' && Array.isArray(val) && val.length === 0) {
        errors[field.name] = `${displayName} requires at least one selection`;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // ---- Serialization & Import/Export -------------------------------------------------------

  exportFieldsJson(): string {
    return JSON.stringify(this.fields, null, 2);
  }

  importFieldsJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        this.setFields(parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  exportDataJson(): string {
    return JSON.stringify(this.values, null, 2);
  }

  importDataJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        this.setValues(parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
