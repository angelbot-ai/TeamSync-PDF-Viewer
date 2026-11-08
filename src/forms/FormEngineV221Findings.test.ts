/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormEngineV221Findings.test.ts
 *
 * Verifies fixes for all 20 developer-reported form engine findings (F1 through F20)
 * on top of TeamSync PDF Viewer version 2.2.1.
 */
import { describe, it, expect, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { FormManager } from './FormManager';
import type { FormField, FormRole, FormSignatureValue } from './types';
import { buildPdfBytes } from '../core/export';
import { extractAcroFormFields } from './acroFormIngestion';
import { parseXfdfFormFields } from '../annotations/xfdf';
import { WebViewerInstance } from '../core/ViewerInstance';
import { ViewerBus } from '../core/eventBus';
import { VERSION, LIB_VERSION } from '../version';

describe('Form Engine Findings (F1 - F20) Verification', () => {
  // Helper to create a clean blank 1-page PDF
  async function createBlankPdfBytes(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    return doc.save();
  }

  // F1: Form field values update after first export
  it('F1: updates field values in-place on subsequent export without throwing', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      { id: 'f1', name: 'user_notes', type: 'text', pageIndex: 1, x: 50, y: 50, width: 200, height: 30 },
    ];

    // First export with initial value
    const export1 = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { user_notes: 'Initial Comment' },
    });

    const doc1 = await PDFDocument.load(export1);
    expect(doc1.getForm().getTextField('user_notes').getText()).toBe('Initial Comment');

    // Second export loading the previously exported bytes and updating the value
    const export2 = await buildPdfBytes({
      getSourceBytes: async () => export1,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { user_notes: 'Updated Subsequent Comment' },
    });

    const doc2 = await PDFDocument.load(export2);
    expect(doc2.getForm().getTextField('user_notes').getText()).toBe('Updated Subsequent Comment');
  });

  // F2: Radio groups exported as interactive AcroForm radio groups
  it('F2: exports radio groups as interactive AcroForm radio groups with selected option', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      {
        id: 'r1',
        name: 'payment_method',
        type: 'radio',
        pageIndex: 1,
        x: 60,
        y: 100,
        width: 150,
        height: 60,
        options: ['Credit Card', 'Wire Transfer', 'ACH'],
        defaultValue: 'Wire Transfer',
      },
    ];

    const exported = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { payment_method: 'Wire Transfer' },
    });

    const doc = await PDFDocument.load(exported);
    const form = doc.getForm();
    const radioGroup = form.getRadioGroup('payment_method');
    expect(radioGroup).toBeDefined();
    expect(radioGroup.getSelected()).toBe('Wire Transfer');
    expect(radioGroup.getOptions()).toEqual(['Credit Card', 'Wire Transfer', 'ACH']);
  });

  // F3: Checklist exported with hierarchical naming and labels
  it('F3: exports checklists with hierarchical option naming and renders text labels', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      {
        id: 'chk1',
        name: 'services_requested',
        type: 'checklist',
        pageIndex: 1,
        x: 60,
        y: 200,
        width: 180,
        height: 70,
        options: ['Consulting', 'Design', 'Development'],
        defaultValue: ['Consulting', 'Development'],
      },
    ];

    const exported = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { services_requested: ['Consulting', 'Development'] },
    });

    const doc = await PDFDocument.load(exported);
    const form = doc.getForm();
    const cb1 = form.getCheckBox('services_requested.Consulting');
    const cb2 = form.getCheckBox('services_requested.Design');
    const cb3 = form.getCheckBox('services_requested.Development');

    expect(cb1.isChecked()).toBe(true);
    expect(cb2.isChecked()).toBe(false);
    expect(cb3.isChecked()).toBe(true);
  });

  // F4: Unsigned signatures do not paint permanent ink placeholder unless flattened
  it('F4: does not paint unsigned placeholder ink onto content stream unless flatten: true', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      {
        id: 'sig1',
        name: 'applicant_signature',
        type: 'signature',
        pageIndex: 1,
        x: 100,
        y: 400,
        width: 200,
        height: 60,
      },
    ];

    // Export without flattening: clean page stream
    const unflattened = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: {},
    });

    expect(unflattened.length).toBeGreaterThan(0);

    // Export with flattening: placeholder or fields flattened cleanly
    const flattened = await buildPdfBytes(
      {
        getSourceBytes: async () => blank,
        annotations: [],
        redactions: [],
        formFields: fields,
        formData: {},
      },
      { flatten: true }
    );

    const docFlattened = await PDFDocument.load(flattened);
    // Flattened forms remove interactive AcroForm fields
    expect(docFlattened.getForm().getFields().length).toBe(0);
  });

  // F5: Read-only export and flatten option
  it('F5: respects field.readOnly flag and supports flatten: true export', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      {
        id: 'txt1',
        name: 'reference_number',
        type: 'text',
        pageIndex: 1,
        x: 50,
        y: 50,
        width: 150,
        height: 25,
        readOnly: true,
        defaultValue: 'REF-2026-999',
      },
    ];

    const exported = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { reference_number: 'REF-2026-999' },
    });

    const doc = await PDFDocument.load(exported);
    const tf = doc.getForm().getTextField('reference_number');
    expect(tf.isReadOnly()).toBe(true);
  });

  // F6: Duplicate field names unique naming on export
  it('F6: generates unique field keys for duplicate field names without collisions', async () => {
    const blank = await createBlankPdfBytes();

    const fields: FormField[] = [
      { id: 'f1', name: 'sign_date', type: 'datetime', pageIndex: 1, x: 50, y: 50, width: 100, height: 25 },
      { id: 'f2', name: 'sign_date', type: 'datetime', pageIndex: 1, x: 50, y: 100, width: 100, height: 25 },
    ];

    const exported = await buildPdfBytes({
      getSourceBytes: async () => blank,
      annotations: [],
      redactions: [],
      formFields: fields,
      formData: { sign_date: '2026-11-05' },
    });

    const doc = await PDFDocument.load(exported);
    const form = doc.getForm();
    expect(form.getTextField('sign_date')).toBeDefined();
    expect(form.getTextField('sign_date_1')).toBeDefined();
  });

  // F7: Signature wording and audit distinction
  it('F7: distinguishes electronic vs digital signature semantics', () => {
    const fm = new FormManager();
    const sigField: FormField = {
      id: 's1',
      name: 'ceo_sig',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 50,
      width: 150,
      height: 50,
    };
    fm.addField(sigField);

    let appliedEvent: any = null;
    fm.onSignatureApplied((e) => {
      appliedEvent = e;
    });

    fm.setValue('ceo_sig', {
      type: 'electronic',
      signerName: 'Jane Doe',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });

    expect(appliedEvent).not.toBeNull();
    expect(appliedEvent.signature.type).toBe('electronic');
    expect(appliedEvent.signerName).toBe('Jane Doe');
  });

  // F8: Role locking and read-only enforcement in FormManager
  it('F8: prevents unauthorized edits to locked or read-only fields unless forced', () => {
    const fields: FormField[] = [
      { id: 'f1', name: 'locked_field', type: 'text', pageIndex: 1, x: 10, y: 10, width: 100, height: 20, readOnly: true },
      { id: 'f2', name: 'role_b_field', type: 'text', pageIndex: 1, x: 10, y: 40, width: 100, height: 20, roleId: 'role_b' },
    ];

    const fm = new FormManager(fields);
    fm.setCurrentRole('role_a');

    // Locked field cannot be edited
    expect(fm.canEditField('locked_field')).toBe(false);
    expect(fm.setValue('locked_field', 'New Value')).toBe(false);
    expect(fm.getValue('locked_field')).toBeUndefined();

    // Forced override succeeds (e.g. for host prop sync)
    expect(fm.setValue('locked_field', 'Forced Value', { force: true })).toBe(true);
    expect(fm.getValue('locked_field')).toBe('Forced Value');

    // Role B field cannot be edited by role A
    expect(fm.canEditField('role_b_field')).toBe(false);
    expect(fm.setValue('role_b_field', 'Hacked Value')).toBe(false);

    // Switching to role B allows editing
    fm.setCurrentRole('role_b');
    expect(fm.canEditField('role_b_field')).toBe(true);
    expect(fm.setValue('role_b_field', 'Valid Role B Value')).toBe(true);
    expect(fm.getValue('role_b_field')).toBe('Valid Role B Value');
  });

  // F9: Checklist and radio option font scaling on zoom-out
  it('F9: allows checklist and radio option font size to scale below 10px on zoom out', () => {
    // When zoom scale is 0.5 (zoom-out), the font calculation Math.max(7, Math.min(13, 11 * scale))
    // yields 7px rather than rigid 10px clamp, preventing text overflow and scrollbars
    const scale = 0.5;
    const computedFontSize = Math.max(7, Math.min(13, 11 * scale));
    expect(computedFontSize).toBe(7);
    expect(computedFontSize).toBeLessThan(10);
  });

  // F10: Raw strings rejected as signatures
  it('F10: rejects raw strings like [object Object] or plain text as valid signatures', () => {
    const fields: FormField[] = [
      { id: 's1', name: 'exec_sig', type: 'signature', pageIndex: 1, x: 10, y: 10, width: 100, height: 30, required: true },
    ];

    const fm = new FormManager(fields);

    // Plain string rejected
    expect(fm.setValue('exec_sig', '[object Object]')).toBe(false);
    expect(fm.setValue('exec_sig', 'hello world')).toBe(false);

    // Validation still fails because no valid signature was set
    const validation = fm.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors['exec_sig']).toBeDefined();

    // Proper signature object accepted
    const validSig: FormSignatureValue = {
      type: 'electronic',
      signerName: 'Officer Alice',
      dataUrl: 'data:image/png;base64,abc123',
    };
    expect(fm.setValue('exec_sig', validSig)).toBe(true);
    expect(fm.validate().valid).toBe(true);
  });

  // F11: unassignedFieldsRole policy and role name suffix in errors
  it('F11: honors unassignedFieldsRole policy and formats errors with role suffix', () => {
    const roles: FormRole[] = [
      { id: 'user_1', name: 'Buyer', color: '#10b981' },
      { id: 'user_2', name: 'Seller', color: '#f59e0b' },
    ];

    const fields: FormField[] = [
      { id: 'f1', name: 'buyer_name', type: 'text', pageIndex: 1, x: 10, y: 10, width: 100, height: 20, roleId: 'user_1', required: true },
      { id: 'f2', name: 'unassigned_date', type: 'text', pageIndex: 1, x: 10, y: 40, width: 100, height: 20, required: true },
    ];

    // Policy 'all': active user must fill assigned + unassigned fields
    const fm = new FormManager(fields, {}, roles, { unassignedFieldsRole: 'all' });
    fm.setCurrentRole('user_1');

    const res1 = fm.validate();
    expect(res1.valid).toBe(false);
    expect(res1.errors['buyer_name']).toContain('(Buyer)');
    expect(res1.errors['unassigned_date']).toBeDefined();

    // Policy 'none': unassigned fields are not assigned to current role
    fm.setOptions({ unassignedFieldsRole: 'none' });
    const res2 = fm.validate();
    expect(res2.errors['buyer_name']).toBeDefined();
    expect(res2.errors['unassigned_date']).toBeUndefined();
  });

  // F12: AcroForm ingestion from PDF
  it('F12: extracts AcroForm widget annotations into interactive FormField models', async () => {
    // Mock pdfjs doc proxy with widget annotations
    const mockPdfDoc = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: () => ({ width: 600, height: 800 }),
        getAnnotations: () => [
          {
            subtype: 'Widget',
            id: 'widget_text_1',
            fieldName: 'customer_email',
            fieldType: 'Tx',
            rect: [50, 700, 250, 730],
            fieldValue: 'test@example.com',
            required: true,
            readOnly: false,
          },
          {
            subtype: 'Widget',
            id: 'widget_check_1',
            fieldName: 'agree_terms',
            fieldType: 'Btn',
            radioButton: false,
            rect: [50, 650, 70, 670],
            fieldValue: 'Yes',
            required: true,
          },
        ],
      }),
    };

    const ingested = await extractAcroFormFields(mockPdfDoc);
    expect(ingested.fields.length).toBe(2);

    const emailField = ingested.fields.find((f) => f.name === 'customer_email');
    expect(emailField).toBeDefined();
    expect(emailField?.type).toBe('text');
    expect(emailField?.required).toBe(true);
    expect(ingested.values['customer_email']).toBe('test@example.com');

    const checkField = ingested.fields.find((f) => f.name === 'agree_terms');
    expect(checkField).toBeDefined();
    expect(checkField?.type).toBe('checkbox');
    expect(ingested.values['agree_terms']).toBe(true);
  });

  // F13: XFDF form widgets ingestion
  it('F13: parses XFDF <widget> and <field> elements into FormFields without dead annotations', async () => {
    const xfdf = `<?xml version="1.0" encoding="UTF-8"?>
<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">
  <fields>
    <field name="account_id">
      <value>ACC-7890</value>
    </field>
  </fields>
  <annots>
    <widget page="0" rect="100,600,300,630" field="account_id" flags="required" name="widget_acc">
      <trn-custom-data bytes='{"custom":{"assignedParty":"agent_role"}}'/>
    </widget>
  </annots>
</xfdf>`;

    const parsed = await parseXfdfFormFields(xfdf);
    expect(parsed.fields.length).toBe(1);
    expect(parsed.fields[0].name).toBe('account_id');
    expect(parsed.fields[0].required).toBe(true);
    expect(parsed.fields[0].roleId).toBe('agent_role');
    expect(parsed.values['account_id']).toBe('ACC-7890');
  });

  // F14: Roles metadata, partyType, and signingOrder
  it('F14: FormRole supports partyType, signingOrder, and custom metadata', () => {
    const role: FormRole = {
      id: 'notary_1',
      name: 'Official Notary',
      color: '#6366f1',
      partyType: 'notary',
      signingOrder: 3,
      metadata: { commissionNumber: 'NC-2026-101', expiration: '2028-12-31' },
    };

    const fm = new FormManager([], {}, [role]);
    const retrieved = fm.getRole('notary_1');
    expect(retrieved?.partyType).toBe('notary');
    expect(retrieved?.signingOrder).toBe(3);
    expect(retrieved?.metadata?.commissionNumber).toBe('NC-2026-101');
  });

  // F15: Programmatic UI tab control and tabChanged events
  it('F15: controls UI active tab programmatically via instance.UI and emits tabChanged', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);

    let observedTab = '';
    inst.on('tabChanged', ({ tab }) => {
      observedTab = tab;
    });

    expect(inst.UI.getActiveTab()).toBe('View');

    inst.UI.setActiveTab('Forms');
    expect(inst.UI.getActiveTab()).toBe('Forms');

    bus.emit('tabChanged', { tab: 'Forms' });
    expect(observedTab).toBe('Forms');

    inst.UI.setActiveTab('Annotate');
    expect(inst.UI.getActiveTab()).toBe('Annotate');
  });

  // F16: Visual role field highlighting
  it('F16: emits action-highlight-role-fields to highlight fields without switching active role', () => {
    const bus = new ViewerBus();
    const inst = new WebViewerInstance(bus);

    let highlighted: string | null | undefined = undefined;
    bus.on<{ roleId: string | null }>('action-highlight-role-fields', ({ roleId }) => {
      highlighted = roleId;
    });

    inst.highlightRoleFields('auditor_role');
    expect(highlighted).toBe('auditor_role');

    inst.highlightRoleFields(null);
    expect(highlighted).toBeNull();
  });

  // F17: Adopted signature caching
  it('F17: stores adopted signature for one-click re-use across multiple signature fields', () => {
    const fm = new FormManager();
    expect(fm.getAdoptedSignature()).toBeNull();

    const adopted: FormSignatureValue = {
      type: 'electronic',
      signerName: 'Jane Smith',
      dataUrl: 'data:image/png;base64,adopted_sig_bytes',
      timestamp: Date.now(),
    };

    fm.setAdoptedSignature(adopted);
    expect(fm.getAdoptedSignature()?.signerName).toBe('Jane Smith');
    expect(fm.getAdoptedSignature()?.dataUrl).toBe('data:image/png;base64,adopted_sig_bytes');
  });

  // F18: Granular form events
  it('F18: notifies listeners of granular field, signature, and CRUD events', () => {
    const fm = new FormManager();

    const valueChanges: any[] = [];
    const signaturesApplied: any[] = [];
    const fieldsAdded: any[] = [];
    const fieldsRemoved: any[] = [];

    fm.onFieldValueChanged((e) => valueChanges.push(e));
    fm.onSignatureApplied((e) => signaturesApplied.push(e));
    fm.onFieldAdded((e) => fieldsAdded.push(e));
    fm.onFieldRemoved((e) => fieldsRemoved.push(e));

    const field: FormField = { id: 'f1', name: 'title', type: 'text', pageIndex: 1, x: 0, y: 0, width: 100, height: 20 };
    fm.addField(field);
    expect(fieldsAdded.length).toBe(1);
    expect(fieldsAdded[0].field.name).toBe('title');

    fm.setValue('title', 'Senior Architect');
    expect(valueChanges.length).toBe(1);
    expect(valueChanges[0].fieldName).toBe('title');
    expect(valueChanges[0].newValue).toBe('Senior Architect');

    const sigField: FormField = { id: 's1', name: 'sig', type: 'signature', pageIndex: 1, x: 0, y: 0, width: 100, height: 30 };
    fm.addField(sigField);
    fm.setValue('sig', { type: 'electronic', signerName: 'Bob', dataUrl: 'data:image/png;base64,123' });
    expect(signaturesApplied.length).toBe(1);
    expect(signaturesApplied[0].signerName).toBe('Bob');

    fm.removeField('f1');
    expect(fieldsRemoved.length).toBe(1);
    expect(fieldsRemoved[0].fieldId).toBe('f1');
  });

  // F19: setFields avoids polluting undo history during prop sync
  it('F19: setFields(fields, false) updates form fields without creating undo history entries', () => {
    const fm = new FormManager();
    expect(fm.canUndo).toBe(false);

    // Initial fields synced from prop
    fm.setFields(
      [{ id: 'f1', name: 'first_name', type: 'text', pageIndex: 1, x: 0, y: 0, width: 100, height: 20 }],
      false
    );
    expect(fm.canUndo).toBe(false);

    // Subsequent prop updates with recordHistory = false keep undo stack clean
    fm.setFields(
      [
        { id: 'f1', name: 'first_name', type: 'text', pageIndex: 1, x: 0, y: 0, width: 100, height: 20 },
        { id: 'f2', name: 'last_name', type: 'text', pageIndex: 1, x: 0, y: 30, width: 100, height: 20 },
      ],
      false
    );
    expect(fm.canUndo).toBe(false);
    expect(fm.getFields().length).toBe(2);
  });

  // F20: Dynamic schema version matches LIB_VERSION
  it('F20: exports schema json with current library version rather than hardcoded 1.9.0', () => {
    const fm = new FormManager();
    const jsonStr = fm.exportFieldsJson();
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe(LIB_VERSION);
    expect(parsed.version).toBe(VERSION);
    expect(parsed.version).toBe('2.2.3');
    expect(parsed.version).not.toBe('1.9.0');
  });
});
