/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFillerActions — utility bar displayed in View mode when the document has form fields.
 */

import React, { useState } from 'react';
import { FileSpreadsheet, RotateCcw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FormManager } from '../forms/FormManager';

interface FormFillerActionsProps {
  formManager: FormManager;
  onDownloadFilledPdf?: () => void;
}

export const FormFillerActions: React.FC<FormFillerActionsProps> = ({
  formManager,
  onDownloadFilledPdf,
}) => {
  const [validationMsg, setValidationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fields = formManager.getFields();
  if (fields.length === 0) return null;

  const requiredCount = fields.filter((f) => f.required).length;

  const handleExportData = () => {
    const json = formManager.exportDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'form-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    const res = formManager.validate();
    if (res.valid) {
      setValidationMsg({ type: 'success', text: 'All required fields are valid!' });
    } else {
      const missingKeys = Object.keys(res.errors).join(', ');
      setValidationMsg({ type: 'error', text: `Missing required: ${missingKeys}` });
    }
    setTimeout(() => setValidationMsg(null), 4000);
  };

  const handleReset = () => {
    if (window.confirm('Clear all filled form entries?')) {
      formManager.clearValues();
      setValidationMsg(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '12px',
        userSelect: 'none',
      }}
    >
      {/* Left: Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '11px',
          }}
        >
          <FileSpreadsheet size={13} /> Interactive Form
        </span>
        <span style={{ color: '#64748b' }}>
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
          {requiredCount > 0 && ` (${requiredCount} required)`}
        </span>

        {validationMsg && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: validationMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: validationMsg.type === 'success' ? '#15803d' : '#b91c1c',
            }}
          >
            {validationMsg.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {validationMsg.text}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleValidate}
          title="Validate form completion"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            color: '#334155',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={13} color="#0284c7" /> Validate Form
        </button>

        <button
          type="button"
          onClick={handleExportData}
          title="Export filled values as JSON"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            color: '#334155',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Download size={13} /> Export Data (JSON)
        </button>

        {onDownloadFilledPdf && (
          <button
            type="button"
            onClick={onDownloadFilledPdf}
            title="Download PDF with filled values"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              backgroundColor: 'var(--primary, #0284c7)',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Download size={13} /> Download Filled PDF
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          title="Reset form entries"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
};
