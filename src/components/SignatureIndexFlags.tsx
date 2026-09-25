/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * SignatureIndexFlags — Clean sidebar flags on the right edge of the viewer
 * showing only the current user's pending and completed signature fields
 * with 1-click jump & sign navigation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react';
import type { FormManager } from '../forms/FormManager';
import type { FormField, FormDataRecord, FormAssignee, FormSignatureValue } from '../forms/types';

interface SignatureIndexFlagsProps {
  formManager: FormManager;
  activeTab: string;
}

export const SignatureIndexFlags: React.FC<SignatureIndexFlagsProps> = ({
  formManager,
  activeTab,
}) => {
  const [fields, setFields] = useState<FormField[]>(() => formManager.getFields());
  const [values, setValues] = useState<FormDataRecord>(() => formManager.getValues());
  const [assignees, setAssignees] = useState<FormAssignee[]>(() => formManager.getAssignees());
  const [currentAssigneeId, setCurrentAssigneeId] = useState<string | null>(() =>
    formManager.getCurrentAssignee()
  );
  const [activeFieldId, setActiveFieldId] = useState<string | null>(() =>
    formManager.getActiveFieldId()
  );
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  useEffect(() => {
    const unsubFields = formManager.onFieldsChange(() => setFields(formManager.getFields()));
    const unsubData = formManager.onDataChange((newVals) => setValues(newVals));
    const unsubAssignees = formManager.onAssigneesChange((newAssignees) =>
      setAssignees(newAssignees)
    );
    const unsubCurrent = formManager.onCurrentAssigneeChange((curr) =>
      setCurrentAssigneeId(curr)
    );
    const unsubActive = formManager.onActiveFieldChange((act) => setActiveFieldId(act));

    return () => {
      unsubFields();
      unsubData();
      unsubAssignees();
      unsubCurrent();
      unsubActive();
    };
  }, [formManager]);

  // All signature fields
  const signatureFields = useMemo(() => {
    return fields.filter(
      (f) => f.type === 'signature' || f.type === 'digital_signature'
    );
  }, [fields]);

  // ONLY show the current user's signatures (strict filter — no other users, no "anyone" overflow)
  const mySignatures = useMemo(() => {
    if (!currentAssigneeId) {
      return []; // No user selected → don't show the dock at all
    }
    return signatureFields.filter(
      (f) => f.assigneeId === currentAssigneeId
    );
  }, [signatureFields, currentAssigneeId]);

  // Only display in View mode
  if (activeTab !== 'View' && activeTab !== 'Forms') {
    return null;
  }

  // Don't render if no user is selected or no signatures for this user
  if (!currentAssigneeId || mySignatures.length === 0) {
    return null;
  }

  const currentAssignee = assignees.find((a) => a.id === currentAssigneeId);
  const userColor = currentAssignee?.color || '#3b82f6';

  const checkIsSigned = (field: FormField): boolean => {
    const val = values[field.name];
    if (!val) return false;
    if (typeof val === 'string' && val.trim().length > 0) return true;
    if (typeof val === 'object' && val !== null) {
      const sig = val as FormSignatureValue;
      return Boolean(sig.dataUrl || sig.signerName || (sig as any).imageUrl);
    }
    return false;
  };

  const pendingCount = mySignatures.filter((f) => !checkIsSigned(f)).length;
  const signedCount = mySignatures.length - pendingCount;

  const handleJumpToSignature = (field: FormField) => {
    formManager.setActiveFieldId(field.id);

    setTimeout(() => {
      const fieldEl = document.getElementById(`tspdf-field-${field.id}`);
      if (fieldEl) {
        fieldEl.focus();
        fieldEl.click();

        // Brief amber highlight flash
        fieldEl.style.transition = 'box-shadow 0.3s ease';
        const originalBoxShadow = fieldEl.style.boxShadow;
        fieldEl.style.boxShadow = '0 0 0 4px #f59e0b, 0 0 20px rgba(245, 158, 11, 0.5)';
        setTimeout(() => {
          fieldEl.style.boxShadow = originalBoxShadow;
        }, 1000);
      }
    }, 250);
  };

  // Collapsed: show a compact pill
  if (isCollapsed) {
    return (
      <div
        className="tspdf-sticky-flags-collapsed"
        style={{
          position: 'absolute',
          right: 0,
          top: '90px',
          zIndex: 40,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          title={`${currentAssignee?.name || 'User'}: ${pendingCount} signature${pendingCount !== 1 ? 's' : ''} pending`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: pendingCount > 0 ? userColor : '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px 0 0 20px',
            padding: '7px 10px 7px 12px',
            cursor: 'pointer',
            boxShadow: '-2px 2px 10px rgba(0, 0, 0, 0.2)',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-3px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <ChevronLeft size={14} />
          {pendingCount > 0 ? (
            <span>{pendingCount} to sign</span>
          ) : (
            <>
              <Check size={14} strokeWidth={3} />
              <span>Done</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside
      className="tspdf-signature-index-flags"
      aria-label="Signature Index Flags"
      style={{
        position: 'absolute',
        right: '0px',
        top: '80px',
        maxHeight: 'calc(100% - 110px)',
        zIndex: 40,
        pointerEvents: 'auto',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: userColor,
          color: '#ffffff',
          padding: '6px 8px 6px 12px',
          borderRadius: '12px 0 0 0',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.2px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <PenTool size={13} />
          {currentAssignee?.name || 'User'}
        </span>

        {/* Progress pill */}
        <span
          style={{
            backgroundColor: 'rgba(255,255,255,0.25)',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '10px',
          }}
        >
          {pendingCount > 0
            ? `${signedCount}/${mySignatures.length}`
            : '✓ All done'}
        </span>

        <button
          onClick={() => setIsCollapsed(true)}
          title="Minimize"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Signature list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 240px)',
          backgroundColor: '#ffffff',
          borderRadius: '0 0 0 12px',
          borderLeft: `2px solid ${userColor}`,
          borderBottom: `1px solid ${userColor}33`,
          boxShadow: '-2px 4px 14px rgba(0,0,0,0.12)',
        }}
      >
        {mySignatures.map((field, idx) => {
          const isSigned = checkIsSigned(field);
          const isHovered = hoveredFieldId === field.id;
          const isActive = activeFieldId === field.id;
          const fieldLabel = field.label || field.name || `Signature ${idx + 1}`;

          return (
            <div
              key={field.id}
              className="tspdf-sticky-index-tab"
              onClick={() => handleJumpToSignature(field)}
              onMouseEnter={() => setHoveredFieldId(field.id)}
              onMouseLeave={() => setHoveredFieldId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: isActive
                  ? `${userColor}12`
                  : isHovered
                  ? '#f8fafc'
                  : '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                transition: 'background-color 0.12s ease',
                minWidth: '160px',
              }}
              title={`Page ${field.pageIndex} · ${fieldLabel}${isSigned ? ' (Signed)' : ' — Click to sign'}`}
            >
              {/* Status icon */}
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: isSigned ? '#dcfce7' : `${userColor}15`,
                  border: `2px solid ${isSigned ? '#16a34a' : userColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isSigned ? (
                  <Check size={12} strokeWidth={3} color="#16a34a" />
                ) : field.type === 'digital_signature' ? (
                  <ShieldCheck size={12} color={userColor} />
                ) : (
                  <PenTool size={11} color={userColor} />
                )}
              </div>

              {/* Field info */}
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isSigned ? '#16a34a' : '#1e293b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}
                >
                  {isSigned ? (
                    <>{fieldLabel} ✓</>
                  ) : (
                    fieldLabel
                  )}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    fontWeight: 500,
                    marginTop: '1px',
                  }}
                >
                  Page {field.pageIndex}
                  {field.flowOrder !== undefined && ` · Step ${field.flowOrder}`}
                  {field.type === 'digital_signature' && ' · Digital'}
                </div>
              </div>

              {/* Jump arrow (visible on hover) */}
              <ChevronRight
                size={14}
                color={isHovered || isActive ? userColor : '#cbd5e1'}
                style={{ flexShrink: 0, transition: 'color 0.12s ease' }}
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
};
