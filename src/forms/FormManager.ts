/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormManager — central state manager for PDF forms builder schema and form filler data.
 */

import type {
  FormField,
  FormDataRecord,
  FormValidationResult,
  FormRole,
  FormFeatureOptions,
} from './types';
import type { ViewerUser } from '../core/types';

export const DEFAULT_FORM_OPTIONS: FormFeatureOptions = {
  canCreateForms: true,
  canFillForms: true,
  allowRoleSwitching: true,
  showRoleSelector: true,
  showSignatureFlags: true,
  showFlowNavigation: true,
  showValidation: true,
  showReset: true,
  showExport: true,
  otherRoleFieldsMode: 'locked',
  hideToolbar: false,
};

export const DEFAULT_ROLES: FormRole[] = [
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
  private roles: FormRole[] = [...DEFAULT_ROLES];
  private currentRoleId: string | null = null;
  private currentUser: ViewerUser | null = null;
  private activeFieldId: string | null = null;
  private options: FormFeatureOptions = { ...DEFAULT_FORM_OPTIONS };
  private past: HistorySnapshot[] = [];
  private future: HistorySnapshot[] = [];
  private fieldsListeners = new Set<FormFieldsChangeListener>();
  private dataListeners = new Set<FormDataChangeListener>();
  private rolesListeners = new Set<(roles: FormRole[]) => void>();
  private activeRoleListeners = new Set<(roleId: string | null) => void>();
  private activeFieldListeners = new Set<(fieldId: string | null) => void>();
  private optionsListeners = new Set<(options: FormFeatureOptions) => void>();
  private userListeners = new Set<(user: ViewerUser | null) => void>();
  private readOnly = false;

  constructor(
    initialFields: FormField[] = [],
    initialValues: FormDataRecord = {},
    initialRoles: FormRole[] = DEFAULT_ROLES,
    initialOptions: Partial<FormFeatureOptions> = {},
    initialUser: ViewerUser | null = null
  ) {
    this.fields = [...initialFields];
    this.values = { ...initialValues };
    this.roles = initialRoles && initialRoles.length > 0 ? [...initialRoles] : [...DEFAULT_ROLES];
    this.options = { ...DEFAULT_FORM_OPTIONS, ...initialOptions };
    if (initialUser) {
      this.setCurrentUser(initialUser);
    }
    if (this.options.currentRole) {
      this.setCurrentRole(this.options.currentRole);
    }
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

  // ---- Field Schema Management ------------------------------------------------------------

  getFields(): FormField[] {
    return [...this.fields];
  }

  getFieldsForPage(pageIndex: number): FormField[] {
    return this.fields.filter((f) => f.pageIndex === pageIndex);
  }

  getField(id: string): FormField | undefined {
    return this.fields.find((f) => f.id === id);
  }

  getFieldByName(name: string): FormField | undefined {
    return this.fields.find((f) => f.name === name);
  }

  setFields(fields: FormField[]): void {
    this.pushHistory();
    this.fields = [...fields];
    // Sync default values
    for (const field of this.fields) {
      if (this.values[field.name] === undefined && field.defaultValue !== undefined) {
        this.values[field.name] = field.defaultValue;
      }
    }
    this.notifyFieldsChange('set');
    this.notifyDataChange();
  }

  addField(field: FormField): void {
    this.pushHistory();
    // Ensure unique ID
    const exists = this.fields.some((f) => f.id === field.id);
    const newField: FormField = exists
      ? { ...field, id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
      : { ...field };

    if (!newField.flowOrder) {
      const pageFields = this.getFieldsForPage(newField.pageIndex);
      newField.flowOrder = pageFields.length + 1;
    }

    this.fields.push(newField);
    if (newField.defaultValue !== undefined && this.values[newField.name] === undefined) {
      this.values[newField.name] = newField.defaultValue;
      this.notifyDataChange();
    }
    this.notifyFieldsChange('add');
  }

  updateField(id: string, updates: Partial<Omit<FormField, 'id'>>, recordHistory = true): boolean {
    const idx = this.fields.findIndex((f) => f.id === id);
    if (idx === -1) return false;

    if (recordHistory) {
      this.pushHistory();
    }
    const oldField = this.fields[idx];
    const updatedField = { ...oldField, ...updates };

    // If name changed, migrate value
    if (updates.name && updates.name !== oldField.name) {
      if (this.values[oldField.name] !== undefined) {
        this.values[updates.name] = this.values[oldField.name];
        delete this.values[oldField.name];
        this.notifyDataChange();
      }
    }

    this.fields[idx] = updatedField;
    this.notifyFieldsChange('update');
    return true;
  }

  deleteField(id: string): boolean {
    const idx = this.fields.findIndex((f) => f.id === id);
    if (idx === -1) return false;

    this.pushHistory();
    const [removed] = this.fields.splice(idx, 1);
    if (removed && this.values[removed.name] !== undefined) {
      delete this.values[removed.name];
      this.notifyDataChange();
    }
    if (this.activeFieldId === id) {
      this.setActiveFieldId(null);
    }
    this.notifyFieldsChange('delete');
    return true;
  }

  clearFields(): void {
    this.pushHistory();
    this.fields = [];
    this.values = {};
    this.setActiveFieldId(null);
    this.notifyFieldsChange('clear');
    this.notifyDataChange();
  }

  // ---- Form Values / Data Management ------------------------------------------------------

  getValues(): FormDataRecord {
    return { ...this.values };
  }

  getValue(name: string): any {
    return this.values[name];
  }

  setValue(name: string, value: any): void {
    this.values = {
      ...this.values,
      [name]: value,
    };
    this.notifyDataChange();
  }

  setValues(newValues: FormDataRecord): void {
    this.values = { ...newValues };
    this.notifyDataChange();
  }

  clearValues(): void {
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

  // ---- Roles (Document Template Role Slots) ------------------------------------------------

  getRoles(): FormRole[] {
    return [...this.roles];
  }

  setRoles(roles: FormRole[]): void {
    this.roles = [...roles];
    for (const l of this.rolesListeners) l(this.getRoles());
  }

  addRole(role: FormRole): void {
    if (this.roles.some((r) => r.id === role.id)) return;
    this.roles.push(role);
    for (const l of this.rolesListeners) l(this.getRoles());
  }

  updateRole(id: string, updates: Partial<Omit<FormRole, 'id'>>): void {
    const idx = this.roles.findIndex((r) => r.id === id);
    if (idx === -1) return;
    this.roles[idx] = { ...this.roles[idx], ...updates };
    for (const l of this.rolesListeners) l(this.getRoles());
  }

  removeRole(id: string): void {
    this.roles = this.roles.filter((r) => r.id !== id);
    let fieldsChanged = false;
    this.fields = this.fields.map((f) => {
      if (f.roleId === id) {
        fieldsChanged = true;
        return { ...f, roleId: undefined };
      }
      return f;
    });

    if (this.currentRoleId === id) {
      this.currentRoleId = null;
      for (const l of this.activeRoleListeners) l(null);
    }

    for (const l of this.rolesListeners) l(this.getRoles());
    if (fieldsChanged) {
      for (const l of this.fieldsListeners) {
        l({
          fields: this.getFields(),
          action: 'update',
        });
      }
    }
  }

  getRole(id?: string): FormRole | undefined {
    if (!id) return undefined;
    return this.roles.find((r) => r.id === id);
  }

  onRolesChange(listener: (roles: FormRole[]) => void): () => void {
    this.rolesListeners.add(listener);
    return () => this.rolesListeners.delete(listener);
  }

  getCurrentRole(): string | null {
    return this.currentRoleId;
  }

  setCurrentRole(roleId: string | null): void {
    this.currentRoleId = roleId;
    for (const l of this.activeRoleListeners) l(roleId);
  }

  onCurrentRoleChange(listener: (roleId: string | null) => void): () => void {
    this.activeRoleListeners.add(listener);
    return () => this.activeRoleListeners.delete(listener);
  }

  // ---- Current User (Host Application User Details) ----------------------------------------

  /** Returns the current logged-in user details passed by the host application. */
  getCurrentUser(): ViewerUser | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  /**
   * Sets the current logged-in user details passed by the host application.
   * If the user object specifies a `role`, automatically sets that role as the active role.
   */
  setCurrentUser(user: ViewerUser | null): void {
    this.currentUser = user ? { ...user } : null;
    if (user?.role) {
      this.setCurrentRole(user.role);
    }
    for (const listener of this.userListeners) {
      try {
        listener(this.getCurrentUser());
      } catch (err) {
        console.error('Error in FormManager currentUser listener:', err);
      }
    }
  }

  /** Subscribes to changes in the current logged-in user details. */
  onCurrentUserChange(listener: (user: ViewerUser | null) => void): () => void {
    this.userListeners.add(listener);
    return () => this.userListeners.delete(listener);
  }

  /**
   * Returns the effective signer name:
   * Prioritizes the actual user's real name (from host application),
   * falling back to the active role name or an empty string.
   */
  getEffectiveSignerName(): string {
    if (this.currentUser?.name) {
      return this.currentUser.name;
    }
    const role = this.getRole(this.currentRoleId || undefined);
    return role?.name || '';
  }

  // ---- Form Feature Visibility & Permissions ----------------------------------------------

  /** Returns the current form feature configuration options. */
  getOptions(): FormFeatureOptions {
    return { ...this.options };
  }

  /**
   * Updates form feature options and notifies active listeners.
   */
  setOptions(opts: Partial<FormFeatureOptions>): void {
    this.options = { ...this.options, ...opts };
    for (const listener of this.optionsListeners) {
      try {
        listener(this.getOptions());
      } catch (err) {
        console.error('Error in FormManager options listener:', err);
      }
    }
  }

  /** Subscribes to changes in form feature options. */
  onOptionsChange(listener: (options: FormFeatureOptions) => void): () => void {
    this.optionsListeners.add(listener);
    return () => this.optionsListeners.delete(listener);
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
   * If roleId is provided, filters to fields assigned to that role.
   */
  getFlowFields(roleId?: string | null): FormField[] {
    const targetRole = roleId !== undefined ? roleId : this.currentRoleId;
    let list = [...this.fields];

    if (targetRole) {
      list = list.filter((f) => f.roleId === targetRole);
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

  getNextField(currentFieldId?: string | null, roleId?: string | null): FormField | null {
    const flow = this.getFlowFields(roleId);
    if (flow.length === 0) return null;
    const curId = currentFieldId ?? this.activeFieldId;
    if (!curId) return flow[0];
    const idx = flow.findIndex((f) => f.id === curId);
    if (idx === -1) return flow[0];
    if (idx + 1 < flow.length) return flow[idx + 1];
    return flow[0]; // loop around
  }

  getPreviousField(currentFieldId?: string | null, roleId?: string | null): FormField | null {
    const flow = this.getFlowFields(roleId);
    if (flow.length === 0) return null;
    const curId = currentFieldId ?? this.activeFieldId;
    if (!curId) return flow[flow.length - 1];
    const idx = flow.findIndex((f) => f.id === curId);
    if (idx === -1) return flow[flow.length - 1];
    if (idx - 1 >= 0) return flow[idx - 1];
    return flow[flow.length - 1]; // loop around
  }

  goToNextField(roleId?: string | null): FormField | null {
    const next = this.getNextField(this.activeFieldId, roleId);
    if (next) {
      this.setActiveFieldId(next.id);
    }
    return next;
  }

  goToPreviousField(roleId?: string | null): FormField | null {
    const prev = this.getPreviousField(this.activeFieldId, roleId);
    if (prev) {
      this.setActiveFieldId(prev.id);
    }
    return prev;
  }

  // ---- Validation --------------------------------------------------------------------------

  validate(roleId?: string | null): FormValidationResult {
    const targetRole = roleId !== undefined ? roleId : this.currentRoleId;
    const errors: Record<string, string> = {};

    for (const field of this.fields) {
      if (!field.required) continue;
      if (targetRole && field.roleId && field.roleId !== targetRole) continue;

      const val = this.values[field.name];
      const displayName = field.label || field.name;

      if (val === undefined || val === null || val === '') {
        errors[field.name] = `${displayName} is required`;
      } else if (field.type === 'checklist' && Array.isArray(val) && val.length === 0) {
        errors[field.name] = `${displayName} requires at least one selection`;
      } else if ((field.type === 'signature' || field.type === 'digital_signature') && typeof val === 'object') {
        const hasSig = Boolean(val.dataUrl || val.signerName || val.imageUrl);
        if (!hasSig) {
          errors[field.name] = `${displayName} signature is required`;
        }
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
        roles: this.roles,
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
        const rolesList = Array.isArray(parsed.roles) ? parsed.roles : null;
        if (rolesList && rolesList.length > 0) {
          this.setRoles(rolesList);
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
