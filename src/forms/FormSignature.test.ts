/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormSignature.test.ts — tests for signature and digital signature placeholders,
 * validation, sign tag text, and multi-user flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormManager } from './FormManager';
import type { FormField, FormSignatureValue } from './types';

describe('Form Signatures & Placeholders Engine', () => {
  let formManager: FormManager;

  beforeEach(() => {
    formManager = new FormManager();
  });

  it('can create electronic and digital signature fields with signTagText', () => {
    const eSigField: FormField = {
      id: 'sig_1',
      name: 'buyer_signature',
      label: 'Buyer E-Signature',
      type: 'signature',
      signatureType: 'electronic',
      signTagText: 'SIGN HERE',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 220,
      height: 60,
      required: true,
      assigneeId: 'user_a',
      flowOrder: 1,
    };

    const dSigField: FormField = {
      id: 'dsig_1',
      name: 'notary_seal',
      label: 'Notary Digital Signature',
      type: 'digital_signature',
      signatureType: 'digital',
      signTagText: 'DIGITAL SEAL',
      pageIndex: 1,
      x: 50,
      y: 200,
      width: 300,
      height: 70,
      required: true,
      assigneeId: 'user_b',
      flowOrder: 2,
    };

    formManager.addField(eSigField);
    formManager.addField(dSigField);

    expect(formManager.getFields().length).toBe(2);
    expect(formManager.getField('sig_1')?.signatureType).toBe('electronic');
    expect(formManager.getField('sig_1')?.signTagText).toBe('SIGN HERE');
    expect(formManager.getField('dsig_1')?.signatureType).toBe('digital');
    expect(formManager.getField('dsig_1')?.signTagText).toBe('DIGITAL SEAL');
  });

  it('validates required electronic signature fields when unsigned vs signed', () => {
    formManager.addField({
      id: 'sig_1',
      name: 'client_signature',
      label: 'Client Signature',
      type: 'signature',
      signatureType: 'electronic',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 200,
      height: 50,
      required: true,
    });

    // Unsigned: should fail validation
    const res1 = formManager.validate();
    expect(res1.valid).toBe(false);
    expect(res1.errors['client_signature']).toBeDefined();

    // Set signed electronic value with dataUrl
    const sigVal: FormSignatureValue = {
      type: 'electronic',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signerName: 'Alice Client',
      timestamp: Date.now(),
    };
    formManager.setValue('client_signature', sigVal);

    const res2 = formManager.validate();
    expect(res2.valid).toBe(true);
    expect(res2.errors['client_signature']).toBeUndefined();
  });

  it('validates required digital signature fields when unsigned vs signed', () => {
    formManager.addField({
      id: 'dsig_1',
      name: 'approver_cert',
      label: 'Approver Certificate',
      type: 'digital_signature',
      signatureType: 'digital',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 200,
      height: 50,
      required: true,
    });

    // Unsigned
    const res1 = formManager.validate();
    expect(res1.valid).toBe(false);
    expect(res1.errors['approver_cert']).toBeDefined();

    // Set signed digital certificate value
    const certVal: FormSignatureValue = {
      type: 'digital',
      signerName: 'Bob Inspector',
      timestamp: Date.now(),
      reason: 'Safety Compliance Passed',
      certificateHash: 'abc123def456',
    };
    formManager.setValue('approver_cert', certVal);

    const res2 = formManager.validate();
    expect(res2.valid).toBe(true);
    expect(res2.errors['approver_cert']).toBeUndefined();
  });

  it('respects per-user assignment when validating required signature fields', () => {
    formManager.addField({
      id: 'sig_a',
      name: 'signature_user_a',
      label: 'User A Signature',
      type: 'signature',
      required: true,
      assigneeId: 'user_a',
      pageIndex: 1,
      x: 10,
      y: 10,
      width: 200,
      height: 50,
    });

    formManager.addField({
      id: 'sig_b',
      name: 'signature_user_b',
      label: 'User B Signature',
      type: 'digital_signature',
      required: true,
      assigneeId: 'user_b',
      pageIndex: 1,
      x: 10,
      y: 70,
      width: 200,
      height: 50,
    });

    // When User A signs their field
    formManager.setValue('signature_user_a', {
      type: 'electronic',
      dataUrl: 'data:image/png;base64,...',
      signerName: 'User A',
    });

    // Validating for User A should pass even though User B has not signed
    const resA = formManager.validate('user_a');
    expect(resA.valid).toBe(true);
    expect(resA.errors['signature_user_a']).toBeUndefined();
    expect(resA.errors['signature_user_b']).toBeUndefined();

    // Validating for User B should fail because User B has not signed yet
    const resB = formManager.validate('user_b');
    expect(resB.valid).toBe(false);
    expect(resB.errors['signature_user_b']).toBeDefined();
    expect(resB.errors['signature_user_a']).toBeUndefined();
  });

  it('serializes and restores signature fields with custom signTagText and signatureType', () => {
    const originalField: FormField = {
      id: 'sig_custom',
      name: 'custom_sig',
      label: 'Custom Signature',
      type: 'signature',
      signatureType: 'electronic',
      signTagText: 'AUTHORIZED SIGNER',
      pageIndex: 1,
      x: 100,
      y: 150,
      width: 220,
      height: 60,
      assigneeId: 'user_a',
      flowOrder: 1,
    };

    formManager.addField(originalField);
    const json = formManager.exportFieldsJson();

    const newManager = new FormManager();
    newManager.importFieldsJson(json);

    const imported = newManager.getField('sig_custom');
    expect(imported).toBeDefined();
    expect(imported?.signatureType).toBe('electronic');
    expect(imported?.signTagText).toBe('AUTHORIZED SIGNER');
    expect(imported?.type).toBe('signature');
  });
});
