/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * SignatureIndexFlags — Sticky / Index Flags docked to the right edge of the viewer.
 * Modeled after physical Post-it "Sign Here" arrow index flags, ensuring that even if a
 * signature field is located on Page 2 (or beyond), the user sees the sticky flag on the
 * side while viewing Page 1 and can jump & sign with a single click.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  // All signature fields in the document
  const signatureFields = useMemo(() => {
    return fields.filter(
      (f) => f.type === 'signature' || f.type === 'digital_signature'
    );
  }, [fields]);

  // Filter signatures based on the current user:
  // - If a user is selected (currentAssigneeId): ONLY show their signature flags (and unassigned ones)
  // - If "All Users / Anyone" (currentAssigneeId is null): show all signature flags in the document
  const relevantSignatures = useMemo(() => {
    if (currentAssigneeId) {
      return signatureFields.filter(
        (f) => f.assigneeId === currentAssigneeId || !f.assigneeId
      );
    }
    return signatureFields;
  }, [signatureFields, currentAssigneeId]);

  const currentAssignee = useMemo(() => {
    if (!currentAssigneeId) return null;
    return assignees.find((a) => a.id === currentAssigneeId) || null;
  }, [assignees, currentAssigneeId]);

  const checkIsSigned = useCallback(
    (field: FormField): boolean => {
      const val = values[field.name];
      if (!val) return false;
      if (typeof val === 'string' && val.trim().length > 0) return true;
      if (typeof val === 'object' && val !== null) {
        const sig = val as FormSignatureValue;
        return Boolean(sig.dataUrl || sig.signerName || (sig as any).imageUrl);
      }
      return false;
    },
    [values]
  );

  const pendingSignatures = useMemo(() => {
    return relevantSignatures.filter((f) => !checkIsSigned(f));
  }, [relevantSignatures, checkIsSigned]);

  const totalPending = pendingSignatures.length;

  const handleJumpToSignature = useCallback(
    (field: FormField) => {
      formManager.setActiveFieldId(field.id);

      // Function to focus, click, and trigger visual highlight on the field DOM element
      const tryFocusAndOpen = (retries = 8, delay = 150) => {
        const fieldEl = document.getElementById(`tspdf-field-${field.id}`);
        if (fieldEl) {
          fieldEl.focus();
          fieldEl.click();

          // High-visibility glowing pulse animation
          fieldEl.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          const originalBoxShadow = fieldEl.style.boxShadow;
          fieldEl.style.boxShadow = '0 0 0 4px #f59e0b, 0 0 25px rgba(245, 158, 11, 0.7)';
          setTimeout(() => {
            fieldEl.style.boxShadow = originalBoxShadow;
          }, 1500);
        } else if (retries > 0) {
          setTimeout(() => tryFocusAndOpen(retries - 1, delay), delay);
        }
      };

      tryFocusAndOpen();
    },
    [formManager]
  );

  // Only display in View or Forms modes
  if (activeTab !== 'View' && activeTab !== 'Forms') {
    return null;
  }

  // If there are no signature fields for this role/document, do not render
  if (relevantSignatures.length === 0) {
    return null;
  }

  // Collapsed State: A sleek, recognizable floating Post-it flag tab
  if (isCollapsed) {
    const accentColor = totalPending > 0 ? (currentAssignee?.color || '#f59e0b') : '#16a34a';
    return (
      <div
        className="tspdf-sticky-flags-collapsed"
        style={{
          position: 'absolute',
          right: 0,
          top: '90px',
          zIndex: 45,
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          title={`Expand Signature Flags (${totalPending} pending)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: accentColor,
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '8px 12px 8px 8px',
            cursor: 'pointer',
            boxShadow: '-3px 4px 14px rgba(0, 0, 0, 0.25)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.3px',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          <ChevronLeft size={16} />
          {totalPending > 0 ? (
            <>
              <span>✍️</span>
              <span>{totalPending} to sign</span>
            </>
          ) : (
            <>
              <Check size={15} strokeWidth={3} />
              <span>All Signed</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <aside
      className="tspdf-signature-index-flags"
      aria-label="Signature Sticky Flags"
      style={{
        position: 'absolute',
        right: '0px',
        top: '80px',
        maxHeight: 'calc(100% - 100px)',
        zIndex: 45,
        pointerEvents: 'auto',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
      }}
    >
      {/* Top Dock Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '6px 10px 6px 12px',
          borderRadius: '8px 0 0 8px',
          boxShadow: '-2px 3px 10px rgba(0,0,0,0.22)',
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PenTool size={13} style={{ color: currentAssignee?.color || '#f59e0b' }} />
          <span>
            {currentAssignee ? `${currentAssignee.name}'s Signatures` : 'Signature Flags'}
          </span>
          <span
            style={{
              backgroundColor: totalPending > 0 ? '#ef4444' : '#16a34a',
              color: '#ffffff',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 800,
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
            borderRadius: '4px',
            marginLeft: '2px',
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

      {/* List of Physical Post-it Style Arrow Flags */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 220px)',
          paddingRight: '0px',
          paddingBottom: '8px',
        }}
      >
        {relevantSignatures.map((field) => {
          const isSigned = checkIsSigned(field);
          const assignee = assignees.find((a) => a.id === field.assigneeId);
          // Color coding: green when signed; otherwise user's color or warm Post-it amber
          const flagColor = isSigned ? '#16a34a' : assignee?.color || '#f59e0b';
          const isHovered = hoveredFieldId === field.id;
          const isActive = activeFieldId === field.id;
          const fieldLabel = field.label || field.name || 'Signature';

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
                  ? 'drop-shadow(-4px 4px 12px rgba(0, 0, 0, 0.3))'
                  : 'drop-shadow(-2px 3px 6px rgba(0, 0, 0, 0.18))',
                transform: isHovered || isActive ? 'translateX(-8px)' : 'translateX(0)',
                transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), filter 0.18s ease',
              }}
              title={`Page ${field.pageIndex}: ${fieldLabel} (${
                isSigned ? 'Signed' : 'Click to jump to page and sign'
              })`}
            >
              {/* Arrow chevron pointing left directly toward the PDF document canvas */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '16px solid transparent',
                  borderBottom: '16px solid transparent',
                  borderRight: `13px solid ${flagColor}`,
                  flexShrink: 0,
                }}
              />

              {/* Sticky Flag Body */}
              <div
                style={{
                  backgroundColor: flagColor,
                  color: '#ffffff',
                  padding: '6px 14px 6px 8px',
                  borderRadius: '0 6px 6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                  boxShadow: 'inset 2px 0 3px rgba(0,0,0,0.12)',
                  minWidth: isHovered ? '170px' : '130px',
                  maxWidth: '260px',
                  justifyContent: 'space-between',
                  transition: 'min-width 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  {isSigned ? (
                    <Check size={14} strokeWidth={3} style={{ flexShrink: 0 }} />
                  ) : field.type === 'digital_signature' ? (
                    <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                  ) : (
                    <PenTool size={13} style={{ flexShrink: 0 }} />
                  )}

                  {/* Prominent Page Badge */}
                  <span
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.25)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    P.{field.pageIndex}
                  </span>

                  {/* Flow order step if set */}
                  {field.flowOrder !== undefined && (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        padding: '1px 5px',
                        borderRadius: '6px',
                        fontSize: '9.5px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      #{field.flowOrder}
                    </span>
                  )}

                  {/* Action & Label text */}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSigned ? 'SIGNED' : field.signTagText || fieldLabel || 'SIGN HERE'}
                  </span>
                </div>

                {/* Assignee / Anyone pill */}
                <div style={{ flexShrink: 0, marginLeft: '6px' }}>
                  {assignee ? (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.22)',
                        padding: '2px 6px',
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
                        padding: '2px 6px',
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
