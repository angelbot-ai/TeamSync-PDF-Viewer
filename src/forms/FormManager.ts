/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormManager — central state manager for PDF forms builder schema and form filler data.
 */

import type { FormField, FormDataRecord, FormValidationResult, FormAssignee } from './types';

export const DEFAULT_ASSIGNEES: FormAssignee[] = [
  { id: 'user_a', name: 'User A', color: '#2563eb' },
  { id: 'user_b', name: 'User B', color: '#9333ea' },
  { id: 'user_c', name: 'User C', color: '#059669' },
];

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
  private assignees: FormAssignee[] = [...DEFAULT_ASSIGNEES];
  private currentAssigneeId: string | null = null;
  private activeFieldId: string | null = null;
  private past: HistorySnapshot[] = [];
  private future: HistorySnapshot[] = [];
  private fieldsListeners = new Set<FormFieldsChangeListener>();
  private dataListeners = new Set<FormDataChangeListener>();
  private assigneesListeners = new Set<(assignees: FormAssignee[]) => void>();
  private activeAssigneeListeners = new Set<(assigneeId: string | null) => void>();
  private activeFieldListeners = new Set<(fieldId: string | null) => void>();
  private readOnly = false;

  constructor(
    initialFields: FormField[] = [],
    initialValues: FormDataRecord = {},
    initialAssignees: FormAssignee[] = DEFAULT_ASSIGNEES
  ) {
    this.fields = [...initialFields];
    this.values = { ...initialValues };
    this.assignees = initialAssignees && initialAssignees.length > 0 ? [...initialAssignees] : [...DEFAULT_ASSIGNEES];
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

  // ---- Assignees & Multi-User -------------------------------------------------------------

  getAssignees(): FormAssignee[] {
    return [...this.assignees];
  }

  setAssignees(assignees: FormAssignee[]): void {
    this.assignees = [...assignees];
    for (const l of this.assigneesListeners) l(this.getAssignees());
  }

  addAssignee(assignee: FormAssignee): void {
    if (this.assignees.some((a) => a.id === assignee.id)) return;
    this.assignees.push(assignee);
    for (const l of this.assigneesListeners) l(this.getAssignees());
  }

  updateAssignee(id: string, updates: Partial<Omit<FormAssignee, 'id'>>): void {
    const idx = this.assignees.findIndex((a) => a.id === id);
    if (idx === -1) return;
    this.assignees[idx] = { ...this.assignees[idx], ...updates };
    for (const l of this.assigneesListeners) l(this.getAssignees());
  }

  removeAssignee(id: string): void {
    this.assignees = this.assignees.filter((a) => a.id !== id);
    // Unassign any fields that were assigned to this user
    let fieldsChanged = false;
    this.fields = this.fields.map((f) => {
      if (f.assigneeId === id) {
        fieldsChanged = true;
        return { ...f, assigneeId: undefined };
      }
      return f;
    });

    if (this.currentAssigneeId === id) {
      this.currentAssigneeId = null;
      for (const l of this.activeAssigneeListeners) l(null);
    }

    for (const l of this.assigneesListeners) l(this.getAssignees());
    if (fieldsChanged) {
      for (const l of this.fieldsListeners) {
        l({
          fields: this.getFields(),
          action: 'update',
        });
      }
    }
  }

  getAssignee(id?: string): FormAssignee | undefined {
    if (!id) return undefined;
    return this.assignees.find((a) => a.id === id);
  }

  onAssigneesChange(listener: (assignees: FormAssignee[]) => void): () => void {
    this.assigneesListeners.add(listener);
    return () => this.assigneesListeners.delete(listener);
  }

  getCurrentAssignee(): string | null {
    return this.currentAssigneeId;
  }

  setCurrentAssignee(id: string | null): void {
    this.currentAssigneeId = id;
    for (const l of this.activeAssigneeListeners) l(id);
  }

  onCurrentAssigneeChange(listener: (assigneeId: string | null) => void): () => void {
    this.activeAssigneeListeners.add(listener);
    return () => this.activeAssigneeListeners.delete(listener);
  }

  // ---- Active Field & Form Flow -----------------------------------------------------------

  getActiveFieldId(): string | null {
    return this.activeFieldId;
  }

  setActiveFieldId(fieldId: string | null): void {
    this.activeFieldId = fieldId;
    for (const l of this.activeFieldListeners) l(fieldId);
  }

  onActiveFieldChange(listener: (fieldId: string | null) => void): () => void {
    this.activeFieldListeners.add(listener);
    return () => this.activeFieldListeners.delete(listener);
  }

  /**
   * Returns form fields sorted according to flow order.
   * If assigneeId is provided, filters to fields assigned to that user.
   */
  getFlowFields(assigneeId?: string | null): FormField[] {
    const targetAssignee = assigneeId !== undefined ? assigneeId : this.currentAssigneeId;
    let list = [...this.fields];

    if (targetAssignee) {
      list = list.filter((f) => f.assigneeId === targetAssignee);
    }

    return list.sort((a, b) => {
      if (a.flowOrder !== undefined && b.flowOrder !== undefined) {
        return a.flowOrder - b.flowOrder;
      }
      if (a.flowOrder !== undefined) return -1;
      if (b.flowOrder !== undefined) return 1;
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
      return a.x - b.x;
    });
  }

  getNextField(currentFieldId?: string | null, assigneeId?: string | null): FormField | null {
    const flow = this.getFlowFields(assigneeId);
    if (flow.length === 0) return null;
    const curId = currentFieldId ?? this.activeFieldId;
    if (!curId) return flow[0];
    const idx = flow.findIndex((f) => f.id === curId);
    if (idx === -1) return flow[0];
    if (idx + 1 < flow.length) return flow[idx + 1];
    return flow[0]; // loop around
  }

  getPreviousField(currentFieldId?: string | null, assigneeId?: string | null): FormField | null {
    const flow = this.getFlowFields(assigneeId);
    if (flow.length === 0) return null;
    const curId = currentFieldId ?? this.activeFieldId;
    if (!curId) return flow[flow.length - 1];
    const idx = flow.findIndex((f) => f.id === curId);
    if (idx === -1) return flow[flow.length - 1];
    if (idx - 1 >= 0) return flow[idx - 1];
    return flow[flow.length - 1]; // loop around
  }

  goToNextField(assigneeId?: string | null): FormField | null {
    const next = this.getNextField(this.activeFieldId, assigneeId);
    if (next) {
      this.setActiveFieldId(next.id);
    }
    return next;
  }

  goToPreviousField(assigneeId?: string | null): FormField | null {
    const prev = this.getPreviousField(this.activeFieldId, assigneeId);
    if (prev) {
      this.setActiveFieldId(prev.id);
    }
    return prev;
  }

  // ---- Validation --------------------------------------------------------------------------

  validate(assigneeId?: string | null): FormValidationResult {
    const targetAssignee = assigneeId !== undefined ? assigneeId : this.currentAssigneeId;
    const errors: Record<string, string> = {};

    for (const field of this.fields) {
      if (!field.required) continue;
      if (targetAssignee && field.assigneeId && field.assigneeId !== targetAssignee) continue;

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
    return JSON.stringify(
      {
        version: '1.9.0',
        fields: this.fields,
        assignees: this.assignees,
      },
      null,
      2
    );
  }

  importFieldsJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        this.setFields(parsed);
        return true;
      }
      if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.fields)) {
        this.setFields(parsed.fields);
        if (Array.isArray(parsed.assignees) && parsed.assignees.length > 0) {
          this.setAssignees(parsed.assignees);
        }
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
