/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildPdfBytes } from './export';
import type { FormField } from '../forms/types';

describe('PDF Export Form Baking (AcroForms)', () => {
  it('bakes form fields into real PDF AcroForms with filled values', async () => {
    // Generate a minimal 1-page blank PDF
    const blankDoc = await PDFDocument.create();
    blankDoc.addPage([600, 800]);
    const blankBytes = await blankDoc.save();

    const formFields: FormField[] = [
      {
        id: 'f1',
        name: 'applicant_name',
        type: 'text',
        pageIndex: 1,
        x: 50,
        y: 50,
        width: 200,
        height: 30,
        label: 'Applicant Name',
      },
      {
        id: 'f2',
        name: 'cover_letter',
        type: 'textarea',
        pageIndex: 1,
        x: 50,
        y: 100,
        width: 300,
        height: 100,
        label: 'Cover Letter',
      },
      {
        id: 'f3',
        name: 'agree_terms',
        type: 'checkbox',
        pageIndex: 1,
        x: 50,
        y: 220,
        width: 20,
        height: 20,
      },
      {
        id: 'f4',
        name: 'role_selection',
        type: 'dropdown',
        pageIndex: 1,
        x: 50,
        y: 260,
        width: 150,
        height: 30,
        options: ['Developer', 'Designer', 'Manager'],
      },
      {
        id: 'f5',
        name: 'requirements',
        type: 'checklist',
        pageIndex: 1,
        x: 50,
        y: 310,
        width: 180,
        height: 80,
        options: ['Remote Eligible', 'Full Time'],
      },
    ];

    const formData = {
      applicant_name: 'Alex Johnson',
      cover_letter: 'I am excited to apply for this position.',
      agree_terms: true,
      role_selection: 'Developer',
      requirements: ['Remote Eligible'],
    };

    const exportedBytes = await buildPdfBytes({
      getSourceBytes: async () => blankBytes,
      annotations: [],
      redactions: [],
      formFields,
      formData,
    });

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.byteLength).toBeGreaterThan(0);

    // Read back exported PDF and verify AcroForms
    const loadedDoc = await PDFDocument.load(exportedBytes);
    const form = loadedDoc.getForm();
    const fields = form.getFields();

    expect(fields.length).toBeGreaterThan(0);

    const textField = form.getTextField('applicant_name');
    expect(textField).toBeDefined();
    expect(textField.getText()).toBe('Alex Johnson');

    const textareaField = form.getTextField('cover_letter');
    expect(textareaField).toBeDefined();
    expect(textareaField.getText()).toBe('I am excited to apply for this position.');

    const checkboxField = form.getCheckBox('agree_terms');
    expect(checkboxField).toBeDefined();
    expect(checkboxField.isChecked()).toBe(true);

    const dropdownField = form.getDropdown('role_selection');
    expect(dropdownField).toBeDefined();
    expect(dropdownField.getSelected()).toEqual(['Developer']);
  });

  it('safely handles duplicate field names without throwing FieldAlreadyExistsError', async () => {
    const blankDoc = await PDFDocument.create();
    blankDoc.addPage([600, 800]);
    const blankBytes = await blankDoc.save();

    const formFields: FormField[] = [
      { id: 'f1', name: 'user_comment', type: 'text', pageIndex: 1, x: 50, y: 50, width: 200, height: 30 },
      { id: 'f2', name: 'user_comment', type: 'text', pageIndex: 1, x: 50, y: 100, width: 200, height: 30 },
      { id: 'f3', name: 'user_comment', type: 'text', pageIndex: 1, x: 50, y: 150, width: 200, height: 30 },
    ];

    const exportedBytes = await buildPdfBytes({
      getSourceBytes: async () => blankBytes,
      annotations: [],
      redactions: [],
      formFields,
      formData: { user_comment: 'Approved' },
    });

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const loadedDoc = await PDFDocument.load(exportedBytes);
    const form = loadedDoc.getForm();
    const fields = form.getFields();
    expect(fields.length).toBe(3);
    expect(form.getTextField('user_comment').getText()).toBe('Approved');
    expect(form.getTextField('user_comment_1').getText()).toBe('Approved');
    expect(form.getTextField('user_comment_2').getText()).toBe('Approved');
  });

  it('embeds Base64 signature data URLs in-memory without throwing', async () => {
    const blankDoc = await PDFDocument.create();
    blankDoc.addPage([600, 800]);
    const blankBytes = await blankDoc.save();

    // 1x1 transparent PNG data URL
    const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const formFields: FormField[] = [
      {
        id: 'sig_1',
        name: 'client_signature',
        type: 'signature',
        signatureType: 'electronic',
        pageIndex: 1,
        x: 50,
        y: 200,
        width: 150,
        height: 50,
      },
    ];

    const exportedBytes = await buildPdfBytes({
      getSourceBytes: async () => blankBytes,
      annotations: [],
      redactions: [],
      formFields,
      formData: {
        client_signature: {
          dataUrl: pngDataUrl,
          signerName: 'Jane Doe',
        },
      },
    });

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.byteLength).toBeGreaterThan(0);
  });
});
