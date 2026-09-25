/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * SignatureIndexFlags — Sticky / Index Flags attached to the side of the viewer
 * to clearly indicate required signatures for the active user across the document.
 * Modeled after physical Post-it arrow index flags, providing 1-click jump & sign navigation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Tag,
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

  // Filter to signature fields
  const signatureFields = useMemo(() => {
    return fields.filter(
      (f) => f.type === 'signature' || f.type === 'digital_signature'
    );
  }, [fields]);

  // Signatures relevant for the current role
  const relevantSignatures = useMemo(() => {
    if (!currentAssigneeId) {
      return signatureFields; // All signatures if no specific role selected
    }
    // Show fields assigned to this user, plus unassigned ones
    return signatureFields.filter(
      (f) => !f.assigneeId || f.assigneeId === currentAssigneeId
    );
  }, [signatureFields, currentAssigneeId]);

  // Only display in View (filler) or Forms modes
  if (activeTab !== 'View' && activeTab !== 'Forms') {
    return null;
  }

  if (signatureFields.length === 0) {
    return null;
  }

  // Determine current user context
  const currentAssignee = assignees.find((a) => a.id === currentAssigneeId);

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

  const pendingSignatures = relevantSignatures.filter((f) => !checkIsSigned(f));
  const totalPending = pendingSignatures.length;

  const handleJumpToSignature = (field: FormField) => {
    formManager.setActiveFieldId(field.id);

    // After scrolling has commenced, trigger click to open modal
    setTimeout(() => {
      const fieldEl = document.getElementById(`tspdf-field-${field.id}`);
      if (fieldEl) {
        fieldEl.focus();
        fieldEl.click();

        // Temporary visual flash highlight
        fieldEl.style.transition = 'box-shadow 0.3s ease';
        const originalBoxShadow = fieldEl.style.boxShadow;
        fieldEl.style.boxShadow = '0 0 0 4px #f59e0b, 0 0 20px rgba(245, 158, 11, 0.6)';
        setTimeout(() => {
          fieldEl.style.boxShadow = originalBoxShadow;
        }, 1200);
      }
    }, 250);
  };

  // If collapsed, display a single compact floating sticky tab
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
          title={`Show signature index flags (${totalPending} pending)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: totalPending > 0 ? (currentAssignee?.color || '#f59e0b') : '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '8px 12px 8px 10px',
            cursor: 'pointer',
            boxShadow: '-3px 4px 12px rgba(0, 0, 0, 0.22)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.3px',
            transition: 'transform 0.15s ease, background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <ChevronLeft size={16} />
          <span>✍️</span>
          <span>{totalPending > 0 ? `${totalPending} Sign` : 'All Signed'}</span>
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
        gap: '6px',
      }}
    >
      {/* Top Dock Header & Minimize Tab */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          padding: '5px 8px 5px 10px',
          borderRadius: '8px 0 0 8px',
          boxShadow: '-2px 3px 8px rgba(0,0,0,0.18)',
          fontSize: '11px',
          fontWeight: 700,
          borderRight: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Tag size={13} style={{ color: currentAssignee?.color || '#38bdf8' }} />
          <span>
            {currentAssignee ? `${currentAssignee.name}'s Signatures` : 'Signature Flags'}
          </span>
          <span
            style={{
              backgroundColor: totalPending > 0 ? '#ef4444' : '#16a34a',
              color: '#ffffff',
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '10px',
              fontWeight: 800,
              marginLeft: '2px',
            }}
          >
            {totalPending > 0 ? `${totalPending} due` : '✓ All signed'}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Minimize signature flags dock"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            marginLeft: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* List of Sticky Index Flags */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '7px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 240px)',
          paddingRight: '0px',
          paddingBottom: '8px',
        }}
      >
        {relevantSignatures.map((field) => {
          const isSigned = checkIsSigned(field);
          const assignee = assignees.find((a) => a.id === field.assigneeId);
          const fieldColor = isSigned ? '#16a34a' : assignee?.color || '#f59e0b';
          const isAssignedToOther =
            currentAssigneeId !== null &&
            Boolean(field.assigneeId) &&
            field.assigneeId !== currentAssigneeId;
          const isHovered = hoveredFieldId === field.id;
          const isActive = activeFieldId === field.id;

          return (
            <div
              key={field.id}
              className="tspdf-sticky-index-tab"
              onClick={() => handleJumpToSignature(field)}
              onMouseEnter={() => setHoveredFieldId(field.id)}
              onMouseLeave={() => setHoveredFieldId(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                filter: isHovered || isActive
                  ? 'drop-shadow(-3px 4px 10px rgba(0, 0, 0, 0.28))'
                  : 'drop-shadow(-2px 3px 6px rgba(0, 0, 0, 0.16))',
                transform: isHovered || isActive ? 'translateX(-5px)' : 'translateX(0)',
                transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.18s ease',
              }}
              title={`Page ${field.pageIndex}: ${field.label || field.name} (${
                isSigned ? 'Signed' : isAssignedToOther ? `Assigned to ${assignee?.name}` : 'Click to jump & sign'
              })`}
            >
              {/* Arrow pointing left toward the PDF document canvas */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '15px solid transparent',
                  borderBottom: '15px solid transparent',
                  borderRight: `12px solid ${isAssignedToOther ? '#94a3b8' : fieldColor}`,
                  flexShrink: 0,
                }}
              />

              {/* Sticky Note / Index Tab Body */}
              <div
                style={{
                  backgroundColor: isAssignedToOther ? '#64748b' : fieldColor,
                  color: '#ffffff',
                  padding: '5px 12px 5px 6px',
                  borderRadius: '0 6px 6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                  boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.12)',
                  minWidth: isHovered ? '160px' : '110px',
                  maxWidth: '240px',
                  justifyContent: 'space-between',
                  transition: 'min-width 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                  {isSigned ? (
                    <Check size={13} strokeWidth={3} style={{ flexShrink: 0 }} />
                  ) : field.type === 'digital_signature' ? (
                    <ShieldCheck size={13} style={{ flexShrink: 0 }} />
                  ) : (
                    <PenTool size={13} style={{ flexShrink: 0 }} />
                  )}

                  {/* Page indicator pill */}
                  <span
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.22)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    P.{field.pageIndex}
                  </span>

                  {/* Flow order pill if available */}
                  {field.flowOrder !== undefined && (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        padding: '1px 4px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      #{field.flowOrder}
                    </span>
                  )}

                  {/* Field Label / Sign Here Text */}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSigned
                      ? 'SIGNED'
                      : field.label || field.signTagText || 'SIGN HERE'}
                  </span>
                </div>

                {/* Assignee pill */}
                <div style={{ flexShrink: 0, marginLeft: '4px' }}>
                  {assignee ? (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.22)',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontSize: '9px',
                        fontWeight: 700,
                      }}
                    >
                      {assignee.name}
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.22)',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontSize: '9px',
                        fontWeight: 600,
                      }}
                    >
                      Anyone
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
