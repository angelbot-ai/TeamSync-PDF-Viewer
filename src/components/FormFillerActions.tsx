/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFillerActions — utility bar displayed in View mode when the document has form fields.
 * Supports multi-user role selection, step-by-step form flow navigation, progress tracking, validation, and export.
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FormManager } from '../forms/FormManager';
import type { FormField, FormDataRecord, FormAssignee, FormFeatureOptions } from '../forms/types';

interface FormFillerActionsProps {
  formManager: FormManager;
  onDownloadFilledPdf?: () => void;
}

export const FormFillerActions: React.FC<FormFillerActionsProps> = ({
  formManager,
  onDownloadFilledPdf,
}) => {
  const [fields, setFields] = useState<FormField[]>(() => formManager.getFields());
  const [values, setValues] = useState<FormDataRecord>(() => formManager.getValues());
  const [assignees, setAssignees] = useState<FormAssignee[]>(() => formManager.getAssignees());
  const [currentAssigneeId, setCurrentAssigneeId] = useState<string | null>(() => formManager.getCurrentAssignee());
  const [activeFieldId, setActiveFieldId] = useState<string | null>(() => formManager.getActiveFieldId());
  const [options, setOptions] = useState<FormFeatureOptions>(() => formManager.getOptions());
  const [validationMsg, setValidationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsubFields = formManager.onFieldsChange(() => setFields(formManager.getFields()));
    const unsubData = formManager.onDataChange((newValues) => setValues(newValues));
    const unsubAssignees = formManager.onAssigneesChange((newAssignees) => setAssignees(newAssignees));
    const unsubCurrent = formManager.onCurrentAssigneeChange((curr) => setCurrentAssigneeId(curr));
    const unsubActive = formManager.onActiveFieldChange((act) => setActiveFieldId(act));
    const unsubOptions = formManager.onOptionsChange((opts) => setOptions(opts));

    return () => {
      unsubFields();
      unsubData();
      unsubAssignees();
      unsubCurrent();
      unsubActive();
      unsubOptions();
    };
  }, [formManager]);

  if (options.hideToolbar || fields.length === 0) return null;

  const currentAssignee = assignees.find((a) => a.id === currentAssigneeId);
  const flowFields = formManager.getFlowFields(currentAssigneeId);
  const currentFlowIndex = activeFieldId ? flowFields.findIndex((f) => f.id === activeFieldId) : -1;

  // Calculate completion progress for current role
  const targetFields = currentAssigneeId ? fields.filter((f) => f.assigneeId === currentAssigneeId) : fields;
  const targetRequiredCount = targetFields.filter((f) => f.required).length;
  const targetFilledCount = targetFields.filter((f) => {
    const val = values[f.name];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;

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
      const scopeLabel = currentAssignee ? `${currentAssignee.name}'s required fields` : 'All required fields';
      setValidationMsg({ type: 'success', text: `${scopeLabel} are valid!` });
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
        padding: '6px 14px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '12px',
        userSelect: 'none',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      {/* Left: Info, User Selector & Flow Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
          <FileSpreadsheet size={13} /> Form Mode
        </span>

        {/* Multi-user "Filling as:" selector */}
        {options.showUserSelector !== false && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              padding: '2px 8px',
            }}
          >
            <Users size={13} color={currentAssignee?.color || '#64748b'} />
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Filling as:</span>
            {options.allowUserSwitching === false ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: currentAssignee?.color || '#334155',
                  padding: '1px 4px',
                }}
                title="Assigned user role is locked by host application"
              >
                {currentAssignee?.name || 'Current User'}
              </span>
            ) : (
              <select
                value={currentAssigneeId || ''}
                onChange={(e) => formManager.setCurrentAssignee(e.target.value || null)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: currentAssignee?.color || '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">All Users / Anyone</option>
                {assignees.map((a) => {
                  const userFieldCount = fields.filter((f) => f.assigneeId === a.id).length;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} ({userFieldCount} {userFieldCount === 1 ? 'field' : 'fields'})
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        )}

        {/* Step-by-Step Flow Navigation Buttons */}
        {options.showFlowNavigation !== false && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '5px',
              padding: '1px 4px',
            }}
          >
            <button
              type="button"
              onClick={() => formManager.goToPreviousField()}
              disabled={flowFields.length === 0}
              title="Previous Field (Shift+Tab)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '3px 4px',
                cursor: flowFields.length > 0 ? 'pointer' : 'not-allowed',
                color: flowFields.length > 0 ? '#334155' : '#94a3b8',
                borderRadius: '3px',
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: currentAssignee?.color || '#334155',
                padding: '0 6px',
                minWidth: '70px',
                textAlign: 'center',
              }}
            >
              {currentFlowIndex >= 0 ? `Step ${currentFlowIndex + 1} of ${flowFields.length}` : `${flowFields.length} steps`}
            </span>

            <button
              type="button"
              onClick={() => formManager.goToNextField()}
              disabled={flowFields.length === 0}
              title="Next Field (Tab)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: '3px 4px',
                cursor: flowFields.length > 0 ? 'pointer' : 'not-allowed',
                color: flowFields.length > 0 ? '#334155' : '#94a3b8',
                borderRadius: '3px',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Progress summary */}
        <span style={{ color: '#64748b', fontSize: '11px' }}>
          {targetFilledCount}/{targetFields.length} completed
          {targetRequiredCount > 0 && ` (${targetRequiredCount} required)`}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {options.showValidation !== false && (
          <button
            type="button"
            onClick={handleValidate}
            title="Validate form completion"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={13} color="#0284c7" /> Validate
          </button>
        )}

        {options.showExport !== false && (
          <button
            type="button"
            onClick={handleExportData}
            title="Export filled values as JSON"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <Download size={13} /> Export JSON
          </button>
        )}

        {options.showExport !== false && onDownloadFilledPdf && (
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
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <Download size={13} /> Download PDF
          </button>
        )}

        {options.showReset !== false && (
          <button
            type="button"
            onClick={handleReset}
            title="Reset form entries"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
    </div>
  );
};
