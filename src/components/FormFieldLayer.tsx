/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFieldLayer — renders form builder controls (Builder mode) or interactive HTML inputs (Filler mode).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Trash2, Copy, Lock, PenTool, ShieldCheck, Check, User } from 'lucide-react';
import type { FormField, FormToolType, FormDataRecord, FormAssignee, FormSignatureValue } from '../forms/types';
import type { FormManager } from '../forms/FormManager';
import { FormFieldEditorModal } from './FormFieldEditorModal';
import { FormSignatureModal } from './FormSignatureModal';
import { convertToRotatedRect, convertToUnrotated } from '../utils/rotationUtils';

interface FormFieldLayerProps {
  pageNum: number;
  scale: number;
  rotation: number;
  basePageWidth: number;
  basePageHeight: number;
  activeTab: string;
  activeTool: FormToolType;
  setActiveTool: (tool: FormToolType) => void;
  formManager: FormManager;
  canFillForms?: boolean;
  showFlowOrder?: boolean;
  selectedAssigneeFilter?: string | null;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const FormFieldLayer: React.FC<FormFieldLayerProps> = ({
  pageNum,
  scale,
  rotation,
  basePageWidth,
  basePageHeight,
  activeTab,
  activeTool,
  setActiveTool,
  formManager,
  canFillForms = true,
  showFlowOrder = true,
  selectedAssigneeFilter = null,
}) => {
  const [fields, setFields] = useState<FormField[]>(() => formManager.getFieldsForPage(pageNum));
  const [values, setValues] = useState<FormDataRecord>(() => formManager.getValues());
  const [assignees, setAssignees] = useState<FormAssignee[]>(() => formManager.getAssignees());
  const [currentAssigneeId, setCurrentAssigneeId] = useState<string | null>(() => formManager.getCurrentAssignee());
  const [activeFieldId, setActiveFieldId] = useState<string | null>(() => formManager.getActiveFieldId());
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [signingField, setSigningField] = useState<FormField | null>(null);

  // Drag creation state
  const [creationRect, setCreationRect] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  // Resize / Move drag state
  const dragRef = useRef<{
    type: 'move' | 'resize';
    handle?: string;
    fieldId: string;
    startX: number;
    startY: number;
    initialField: FormField;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const unW = rotation % 180 === 0 ? basePageWidth : basePageHeight;
  const unH = rotation % 180 === 0 ? basePageHeight : basePageWidth;

  // Sync fields, values, assignees and flow state from FormManager
  useEffect(() => {
    const unsubFields = formManager.onFieldsChange(() => {
      setFields(formManager.getFieldsForPage(pageNum));
    });
    const unsubData = formManager.onDataChange((newValues) => {
      setValues(newValues);
    });
    const unsubAssignees = formManager.onAssigneesChange((newAssignees) => {
      setAssignees(newAssignees);
    });
    const unsubCurrent = formManager.onCurrentAssigneeChange((curr) => {
      setCurrentAssigneeId(curr);
    });
    const unsubActive = formManager.onActiveFieldChange((actId) => {
      setActiveFieldId(actId);
    });
    return () => {
      unsubFields();
      unsubData();
      unsubAssignees();
      unsubCurrent();
      unsubActive();
    };
  }, [formManager, pageNum]);

  // Auto-focus active field when navigated in Filler mode
  useEffect(() => {
    if (activeFieldId && activeTab === 'View') {
      const el = document.getElementById(`tspdf-field-${activeFieldId}`);
      if (el && document.activeElement !== el) {
        el.focus();
      }
    }
  }, [activeFieldId, activeTab]);

  // Keyboard deletion of selected field in builder
  useEffect(() => {
    if (activeTab !== 'Forms' || !selectedFieldId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingField) return; // Don't delete if modal is open
      if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        formManager.deleteField(selectedFieldId);
        setSelectedFieldId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedFieldId, formManager, editingField]);

  // Convert mouse event coordinates to unrotated PDF points
  const getPdfCoordinates = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / scale;
    const rawY = (e.clientY - rect.top) / scale;
    return convertToUnrotated(rawX, rawY, rotation, unW, unH);
  }, [scale, rotation, unW, unH]);

  // ---- Drag to Create Field ----------------------------------------------------------------
  const isCreating = activeTab === 'Forms' && activeTool && activeTool !== 'select';

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCreating) {
      if (activeTab === 'Forms' && e.target === containerRef.current) {
        setSelectedFieldId(null);
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const pt = getPdfCoordinates(e);
    setCreationRect({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragRef.current) {
      e.preventDefault();
      const pt = getPdfCoordinates(e);
      const { type, handle, fieldId, startX, startY, initialField } = dragRef.current;
      const dx = pt.x - startX;
      const dy = pt.y - startY;

      if (type === 'move') {
        const newX = Math.max(0, Math.min(basePageWidth - initialField.width, initialField.x + dx));
        const newY = Math.max(0, Math.min(basePageHeight - initialField.height, initialField.y + dy));
        formManager.updateField(fieldId, { x: Math.round(newX), y: Math.round(newY) }, false);
      } else if (type === 'resize' && handle) {
        let { x, y, width, height } = initialField;
        if (handle.includes('e')) width = Math.max(30, initialField.width + dx);
        if (handle.includes('s')) height = Math.max(20, initialField.height + dy);
        if (handle.includes('w')) {
          const proposedW = initialField.width - dx;
          if (proposedW >= 30) {
            width = proposedW;
            x = initialField.x + dx;
          }
        }
        if (handle.includes('n')) {
          const proposedH = initialField.height - dy;
          if (proposedH >= 20) {
            height = proposedH;
            y = initialField.y + dy;
          }
        }
        formManager.updateField(fieldId, {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        }, false);
      }
      return;
    }

    if (creationRect) {
      const pt = getPdfCoordinates(e);
      setCreationRect(prev => prev ? { ...prev, curX: pt.x, curY: pt.y } : null);
    }
  }, [creationRect, getPdfCoordinates, basePageWidth, basePageHeight, formManager]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
    }

    if (creationRect) {
      const minX = Math.min(creationRect.startX, creationRect.curX);
      const minY = Math.min(creationRect.startY, creationRect.curY);
      const w = Math.abs(creationRect.curX - creationRect.startX);
      const h = Math.abs(creationRect.curY - creationRect.startY);

      // Only create if rectangle has reasonable dimensions and active creation tool
      if (activeTool && activeTool !== 'select' && w >= 20 && h >= 15) {
        const defaultLabels: Record<string, string> = {
          textbox: 'Text Field',
          textarea: 'Text Area',
          datetime: 'Date/Time',
          checklist: 'Checklist',
          dropdown: 'Dropdown',
          radio: 'Radio Group',
          signature: 'E-Signature',
          digital_signature: 'Digital Signature',
        };

        const existingCount = formManager.getFields().length;
        const targetAssigneeId = selectedAssigneeFilter || undefined;
        const isSig = activeTool === 'signature';
        const isDigitalSig = activeTool === 'digital_signature';

        const newField: FormField = {
          id: newId(),
          name: `${activeTool}_${existingCount + 1}`,
          label: defaultLabels[activeTool] || 'Field',
          type: activeTool === 'textbox' ? 'text' : (activeTool as any),
          pageIndex: pageNum,
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.round(w),
          height: Math.round(h),
          required: false,
          assigneeId: targetAssigneeId,
          flowOrder: existingCount + 1,
          fontSize: 13,
          textColor: '#0f172a',
          backgroundColor: '#ffffff',
          borderRadius: 3,
          borderWidth: 1,
          options: ['checklist', 'dropdown', 'radio'].includes(activeTool)
            ? ['Option 1', 'Option 2', 'Option 3']
            : undefined,
          dateFormat: activeTool === 'datetime' ? 'datetime' : undefined,
          signatureType: isDigitalSig ? 'digital' : isSig ? 'electronic' : undefined,
          signTagText: isDigitalSig ? 'DIGITAL SIGN' : isSig ? 'SIGN HERE' : undefined,
        };

        formManager.addField(newField);
        setSelectedFieldId(newField.id);
        setActiveTool('select');
      }

      setCreationRect(null);
    }
  }, [creationRect, activeTool, pageNum, formManager, setActiveTool, selectedAssigneeFilter]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleStartMove = (field: FormField, e: React.MouseEvent) => {
    if (activeTab !== 'Forms' || activeTool !== 'select') return;
    e.stopPropagation();
    setSelectedFieldId(field.id);
    const pt = getPdfCoordinates(e);
    dragRef.current = {
      type: 'move',
      fieldId: field.id,
      startX: pt.x,
      startY: pt.y,
      initialField: { ...field },
    };
  };

  const handleStartResize = (field: FormField, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = getPdfCoordinates(e);
    dragRef.current = {
      type: 'resize',
      handle,
      fieldId: field.id,
      startX: pt.x,
      startY: pt.y,
      initialField: { ...field },
    };
  };

  const handleDuplicateField = (field: FormField, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: FormField = {
      ...field,
      id: newId(),
      name: `${field.name}_copy`,
      x: Math.min(basePageWidth - field.width, field.x + 20),
      y: Math.min(basePageHeight - field.height, field.y + 20),
      flowOrder: field.flowOrder !== undefined ? field.flowOrder + 1 : undefined,
    };
    formManager.addField(dup);
    setSelectedFieldId(dup.id);
  };

  const handleDeleteField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    formManager.deleteField(id);
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  // Keyboard navigation helper for filler inputs
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        formManager.goToPreviousField();
      } else {
        formManager.goToNextField();
      }
    }
  };

  // Render Creation Preview Box
  let creationBox = null;
  if (creationRect) {
    const minX = Math.min(creationRect.startX, creationRect.curX);
    const minY = Math.min(creationRect.startY, creationRect.curY);
    const w = Math.abs(creationRect.curX - creationRect.startX);
    const h = Math.abs(creationRect.curY - creationRect.startY);
    const rot = convertToRotatedRect(minX, minY, w, h, rotation, unW, unH);

    creationBox = (
      <div
        style={{
          position: 'absolute',
          left: `${rot.x * scale}px`,
          top: `${rot.y * scale}px`,
          width: `${rot.width * scale}px`,
          height: `${rot.height * scale}px`,
          border: '1.5px dashed #0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.15)',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="tspdf-form-field-layer"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: activeTab === 'Forms' ? 'auto' : 'none',
        cursor: isCreating ? 'crosshair' : 'default',
        zIndex: 15,
      }}
    >
      {creationBox}

      {/* Render All Form Fields for this page */}
      {fields.map((field) => {
        const rot = convertToRotatedRect(field.x, field.y, field.width, field.height, rotation, unW, unH);
        const isSelected = activeTab === 'Forms' && selectedFieldId === field.id;
        const fieldValue = values[field.name] !== undefined ? values[field.name] : (field.defaultValue ?? '');

        const assignee = assignees.find((a) => a.id === field.assigneeId);
        const fieldColor = assignee?.color || '#64748b';
        const isFilteredOut = Boolean(selectedAssigneeFilter && field.assigneeId !== selectedAssigneeFilter);

        // --------------------------------------------------------------------------------------
        // BUILDER MODE PRESENTATION
        // --------------------------------------------------------------------------------------
        if (activeTab === 'Forms') {
          return (
            <div
              key={field.id}
              className="tspdf-form-field-builder"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFieldId(field.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingField(field);
              }}
              onMouseDown={(e) => handleStartMove(field, e)}
              style={{
                position: 'absolute',
                left: `${rot.x * scale}px`,
                top: `${rot.y * scale}px`,
                width: `${rot.width * scale}px`,
                height: `${rot.height * scale}px`,
                backgroundColor: isSelected ? `${fieldColor}26` : `${fieldColor}12`,
                border: isSelected ? `2px solid ${fieldColor}` : `1.5px dashed ${fieldColor}`,
                borderRadius: `${field.borderRadius ?? 4}px`,
                cursor: 'move',
                zIndex: isSelected ? 25 : 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4px 6px',
                boxSizing: 'border-box',
                boxShadow: isSelected ? `0 0 0 2px ${fieldColor}4d` : 'none',
                opacity: isFilteredOut ? 0.35 : 1,
                transition: 'opacity 0.15s ease',
              }}
            >
              {/* Field Label, Flow Order & Assignee Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                  {showFlowOrder && field.flowOrder !== undefined && (
                    <span
                      style={{
                        fontSize: `${Math.max(9, 10 * scale)}px`,
                        fontWeight: 700,
                        backgroundColor: fieldColor,
                        color: '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        flexShrink: 0,
                        lineHeight: 1.2,
                      }}
                      title={`Flow step ${field.flowOrder}`}
                    >
                      #{field.flowOrder}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: `${Math.max(10, 11 * scale)}px`,
                      fontWeight: 600,
                      color: fieldColor,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {field.label || field.name}
                    {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {assignee ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: `${Math.max(8, 9 * scale)}px`,
                        backgroundColor: `${fieldColor}22`,
                        color: fieldColor,
                        border: `1px solid ${fieldColor}44`,
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        maxWidth: `${140 * scale}px`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={`Assigned to ${assignee.name}`}
                    >
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: fieldColor, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignee.name}</span>
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: `${Math.max(8, 9 * scale)}px`,
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 500,
                      }}
                      title="Open for anyone to fill"
                    >
                      Anyone
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: `${Math.max(8, 9 * scale)}px`,
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    {field.type}
                  </span>
                </div>
              </div>

              {/* 'Sign Here' Arrow Flag Tag on Signature Placeholders (Builder Mode) */}
              {(field.type === 'signature' || field.type === 'digital_signature') && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 32,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: fieldColor,
                      color: '#ffffff',
                      fontSize: `${Math.max(9, 9.5 * scale)}px`,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '3px 0 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      letterSpacing: '0.3px',
                      lineHeight: 1.2,
                    }}
                  >
                    <span>
                      ✍️ {field.signTagText || (field.type === 'digital_signature' ? 'DIGITAL SIGN' : 'SIGN HERE')}
                      {assignee ? ` (${assignee.name})` : ''}
                    </span>
                  </div>
                  {/* Arrow pointing into the signature box */}
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '9px solid transparent',
                      borderBottom: '9px solid transparent',
                      borderLeft: `7px solid ${fieldColor}`,
                    }}
                  />
                </div>
              )}

              {/* Signature Baseline inside Builder Box */}
              {(field.type === 'signature' || field.type === 'digital_signature') && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '2px 4px 4px 4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderBottom: `1.5px dashed ${fieldColor}88`,
                      paddingBottom: '2px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: fieldColor }}>✕</span>
                    <span style={{ fontSize: `${Math.max(9, 10 * scale)}px`, color: '#64748b' }}>
                      {field.type === 'digital_signature' ? 'Digital Signature Placeholder' : 'E-Signature Placeholder'}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick floating action bar when selected */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-32px',
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#ffffff',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #e5e7eb',
                    zIndex: 35,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Quick User Assignment Dropdown */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      paddingRight: '6px',
                      borderRight: '1px solid #e5e7eb',
                    }}
                  >
                    <User size={13} color={fieldColor} />
                    <select
                      value={field.assigneeId || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        const nextId = e.target.value || undefined;
                        const nextAssignee = assignees.find((a) => a.id === nextId);
                        formManager.updateField(field.id, {
                          assigneeId: nextId,
                          borderColor: nextAssignee ? nextAssignee.color : undefined,
                        });
                      }}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 4px',
                        borderRadius: '3px',
                        border: `1px solid ${fieldColor}66`,
                        backgroundColor: '#f8fafc',
                        color: fieldColor,
                        cursor: 'pointer',
                        outline: 'none',
                        height: '22px',
                      }}
                      title="Assign this field to a user"
                    >
                      <option value="">Anyone</option>
                      {assignees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    title="Edit Field Properties"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingField(field);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: fieldColor,
                    }}
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    type="button"
                    title="Duplicate Field"
                    onClick={(e) => handleDuplicateField(field, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#4b5563',
                    }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    title="Delete Field (Del / Backspace)"
                    onClick={(e) => handleDeleteField(field.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#ef4444',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {/* 8 Resize Handles */}
              {isSelected && (
                <>
                  {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                    const handleStyle: React.CSSProperties = {
                      position: 'absolute',
                      width: '7px',
                      height: '7px',
                      backgroundColor: '#ffffff',
                      border: `1.5px solid ${fieldColor}`,
                      borderRadius: '1px',
                      zIndex: 30,
                    };
                    if (handle.includes('n')) handleStyle.top = '-4px';
                    if (handle.includes('s')) handleStyle.bottom = '-4px';
                    if (handle.includes('w')) handleStyle.left = '-4px';
                    if (handle.includes('e')) handleStyle.right = '-4px';
                    if (handle === 'n' || handle === 's') handleStyle.left = 'calc(50% - 3.5px)';
                    if (handle === 'w' || handle === 'e') handleStyle.top = 'calc(50% - 3.5px)';

                    const cursors: Record<string, string> = {
                      nw: 'nwse-resize',
                      n: 'ns-resize',
                      ne: 'nesw-resize',
                      e: 'ew-resize',
                      se: 'nwse-resize',
                      s: 'ns-resize',
                      sw: 'nesw-resize',
                      w: 'ew-resize',
                    };
                    handleStyle.cursor = cursors[handle];

                    return (
                      <div
                        key={handle}
                        style={handleStyle}
                        onMouseDown={(e) => handleStartResize(field, handle, e)}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        }

        // --------------------------------------------------------------------------------------
        // FILLER MODE PRESENTATION (View Tab)
        // --------------------------------------------------------------------------------------
        const isAssignedToOther = currentAssigneeId !== null && !!field.assigneeId && field.assigneeId !== currentAssigneeId;
        const isReadOnly = !canFillForms || field.readOnly || isAssignedToOther;
        const isActive = activeFieldId === field.id;

        // Custom styled dimensions and appearance
        const effectiveFontSizePx = Math.max(10, (field.fontSize || 13) * scale);
        const effectiveFontFamily = field.fontFamily || 'inherit';
        const effectiveFontWeight = field.fontWeight || 'normal';
        const effectiveFontStyle = field.fontStyle || 'normal';
        const effectiveTextAlign = field.textAlign || 'left';

        const effectiveTextColor = isAssignedToOther
          ? '#94a3b8'
          : field.textColor || '#0f172a';

        const effectiveBgColor = isAssignedToOther
          ? 'rgba(241, 245, 249, 0.8)'
          : field.backgroundColor === 'transparent'
          ? 'transparent'
          : field.backgroundColor || '#ffffff';

        const effectiveBorderColor = isAssignedToOther
          ? '#cbd5e1'
          : assignee
          ? (field.borderColor || assignee.color)
          : (field.borderColor && !assignees.some((a) => a.color === field.borderColor) ? field.borderColor : '#94a3b8');

        const effectiveBorderWidth = field.borderWidth ?? 1.5;
        const effectiveBorderRadius = field.borderRadius ?? 3;

        const isSignature = field.type === 'signature' || field.type === 'digital_signature';
        const sigVal: FormSignatureValue | null =
          typeof fieldValue === 'object' && fieldValue !== null
            ? fieldValue
            : fieldValue
            ? {
                type: field.type === 'digital_signature' ? 'digital' : 'electronic',
                dataUrl: typeof fieldValue === 'string' && fieldValue.startsWith('data:') ? fieldValue : undefined,
                signerName: typeof fieldValue === 'string' ? fieldValue : undefined,
              }
            : null;
        const isSigned = Boolean(sigVal && (sigVal.dataUrl || sigVal.signerName || (sigVal as any).imageUrl));

        const baseInputStyle: React.CSSProperties = {
          width: '100%',
          height: '100%',
          fontSize: `${effectiveFontSizePx}px`,
          fontFamily: effectiveFontFamily,
          fontWeight: effectiveFontWeight,
          fontStyle: effectiveFontStyle,
          textAlign: effectiveTextAlign,
          color: effectiveTextColor,
          backgroundColor: effectiveBgColor,
          border: `${effectiveBorderWidth}px solid ${effectiveBorderColor}`,
          borderRadius: `${effectiveBorderRadius}px`,
          boxSizing: 'border-box',
          outline: 'none',
          boxShadow: isActive
            ? `0 0 0 2.5px ${fieldColor}80`
            : isAssignedToOther
            ? 'none'
            : '0 1px 2px rgba(0, 0, 0, 0.05)',
          cursor: isReadOnly ? 'not-allowed' : 'text',
          transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        };

        const handleFocus = () => {
          formManager.setActiveFieldId(field.id);
        };

        return (
          <div
            key={field.id}
            style={{
              position: 'absolute',
              left: `${rot.x * scale}px`,
              top: `${rot.y * scale}px`,
              width: `${rot.width * scale}px`,
              height: `${rot.height * scale}px`,
              zIndex: isActive ? 22 : 16,
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}
          >
            {/* Field Header Badge for View (Filler) Mode */}
            {!isSignature ? (
              <div
                style={{
                  position: 'absolute',
                  top: rot.y * scale < 22 ? `${rot.height * scale + 2}px` : '-19px',
                  left: '0px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#ffffff',
                  color: isAssignedToOther ? '#64748b' : fieldColor,
                  border: `1px solid ${isAssignedToOther ? '#cbd5e1' : `${fieldColor}99`}`,
                  fontSize: `${Math.max(8.5, 9.5 * scale)}px`,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  pointerEvents: 'none',
                  zIndex: 25,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  maxWidth: `${Math.max(220, rot.width * scale * 1.5)}px`,
                }}
              >
                {isAssignedToOther && (
                  <Lock size={10} style={{ flexShrink: 0, color: '#64748b' }} />
                )}

                {showFlowOrder && field.flowOrder !== undefined && (
                  <span
                    style={{
                      backgroundColor: isAssignedToOther ? '#94a3b8' : fieldColor,
                      color: '#ffffff',
                      fontSize: `${Math.max(7.5, 8.5 * scale)}px`,
                      fontWeight: 700,
                      padding: '0 4px',
                      borderRadius: '8px',
                      lineHeight: 1.2,
                      flexShrink: 0,
                    }}
                    title={`Step #${field.flowOrder}`}
                  >
                    #{field.flowOrder}
                  </span>
                )}

                {/* Field Label / Name */}
                <span
                  style={{
                    fontWeight: 700,
                    color: isAssignedToOther ? '#64748b' : '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={field.label || field.name}
                >
                  {field.label || field.name}
                  {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                </span>

                {/* Assignee Badge */}
                {assignee ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      backgroundColor: `${fieldColor}18`,
                      color: fieldColor,
                      fontSize: `${Math.max(7.5, 8.5 * scale)}px`,
                      fontWeight: 600,
                      padding: '0 4px',
                      borderRadius: '10px',
                      flexShrink: 0,
                      marginLeft: '2px',
                    }}
                    title={`Assigned to ${assignee.name}`}
                  >
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: fieldColor }} />
                    {assignee.name}
                  </span>
                ) : (
                  <span
                    style={{
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      fontSize: `${Math.max(7.5, 8.5 * scale)}px`,
                      fontWeight: 500,
                      padding: '0 3px',
                      borderRadius: '3px',
                      flexShrink: 0,
                      marginLeft: '2px',
                    }}
                    title="Anyone can fill this field"
                  >
                    Anyone
                  </span>
                )}
              </div>
            ) : (
              /* Signature Flag Tag with arrow pointing directly into signature box */
              <div
                style={{
                  position: 'absolute',
                  top: rot.y * scale < 22 ? `${rot.height * scale + 2}px` : '-20px',
                  left: '0px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  zIndex: 26,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                }}
              >
                <div
                  style={{
                    backgroundColor: isSigned ? '#16a34a' : isAssignedToOther ? '#64748b' : fieldColor,
                    color: '#ffffff',
                    fontSize: `${Math.max(9, 9.5 * scale)}px`,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '3px 0 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    letterSpacing: '0.3px',
                    lineHeight: 1.2,
                    maxWidth: `${Math.max(220, rot.width * scale * 1.5)}px`,
                  }}
                >
                  {isAssignedToOther && <Lock size={10} style={{ flexShrink: 0 }} />}
                  {showFlowOrder && field.flowOrder !== undefined && (
                    <span
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                        color: '#ffffff',
                        fontSize: `${Math.max(7.5, 8.5 * scale)}px`,
                        fontWeight: 800,
                        padding: '0 4px',
                        borderRadius: '6px',
                        lineHeight: 1.2,
                        marginRight: '2px',
                        flexShrink: 0,
                      }}
                      title={`Step #${field.flowOrder}`}
                    >
                      #{field.flowOrder}
                    </span>
                  )}
                  {isSigned ? (
                    <>
                      <Check size={11} strokeWidth={3} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        SIGNED{field.label ? `: ${field.label}` : ''}
                      </span>
                    </>
                  ) : (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ✍️ {field.signTagText || (field.type === 'digital_signature' ? 'DIGITAL SIGN' : 'SIGN HERE')}
                      {field.label && field.label !== field.signTagText ? ` · ${field.label}` : ''}
                      {assignee ? ` (${assignee.name})` : ''}
                      {field.required && <span style={{ color: '#fca5a5' }}> *</span>}
                    </span>
                  )}
                </div>
                {/* Arrow pointing into the signature box */}
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: '9px solid transparent',
                    borderBottom: '9px solid transparent',
                    borderLeft: `7px solid ${isSigned ? '#16a34a' : isAssignedToOther ? '#64748b' : fieldColor}`,
                  }}
                />
              </div>
            )}

            {/* Page Margin Sticky / Index Flag for Signature — only for current user's fields */}
            {isSignature && activeTab === 'View' && (!currentAssigneeId || !field.assigneeId || field.assigneeId === currentAssigneeId) && (
              <div
                className="tspdf-page-sticky-flag"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isReadOnly) {
                    setSigningField(field);
                  }
                }}
                style={{
                  position: 'absolute',
                  right: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%) translateX(100%)',
                  zIndex: 26,
                  cursor: isReadOnly ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
                title={
                  isSigned
                    ? `Signed: ${field.label || 'Signature'}`
                    : `Click to sign: ${field.label || 'Signature'}`
                }
              >
                <div
                  style={{
                    backgroundColor: isSigned ? '#16a34a' : fieldColor,
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: `${Math.max(9, 10 * scale)}px`,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }}
                >
                  {isSigned ? (
                    <>
                      <Check size={11} strokeWidth={3} />
                      <span>Signed</span>
                    </>
                  ) : (
                    <>
                      <PenTool size={10} />
                      <span>Sign</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Textbox Input */}
            {(field.type === 'text' || (field.type as string) === 'textbox') && (
              <input
                id={`tspdf-field-${field.id}`}
                type="text"
                disabled={isReadOnly}
                value={fieldValue}
                placeholder={field.placeholder || field.label || ''}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                style={{
                  ...baseInputStyle,
                  padding: `${2 * scale}px ${6 * scale}px`,
                }}
              />
            )}

            {/* Text Area Input */}
            {field.type === 'textarea' && (
              <textarea
                id={`tspdf-field-${field.id}`}
                disabled={isReadOnly}
                value={fieldValue}
                placeholder={field.placeholder || field.label || ''}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                style={{
                  ...baseInputStyle,
                  resize: 'none',
                  padding: `${4 * scale}px ${6 * scale}px`,
                }}
              />
            )}

            {/* Date and Time Picker */}
            {field.type === 'datetime' && (
              <input
                id={`tspdf-field-${field.id}`}
                type={field.dateFormat === 'date' ? 'date' : field.dateFormat === 'time' ? 'time' : 'datetime-local'}
                disabled={isReadOnly}
                value={fieldValue}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                style={{
                  ...baseInputStyle,
                  padding: `${2 * scale}px ${6 * scale}px`,
                }}
              />
            )}

            {/* Check List (Multi-item list with checkboxes) */}
            {field.type === 'checklist' && (
              <div
                id={`tspdf-field-${field.id}`}
                tabIndex={isReadOnly ? -1 : 0}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                style={{
                  ...baseInputStyle,
                  padding: `${4 * scale}px ${6 * scale}px`,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${2 * scale}px`,
                  cursor: isReadOnly ? 'not-allowed' : 'default',
                }}
              >
                {(field.options && field.options.length > 0 ? field.options : ['Check item']).map((opt, oIdx) => {
                  const currentCheckedList: string[] = Array.isArray(fieldValue) ? fieldValue : [];
                  const isChecked = currentCheckedList.includes(opt);

                  return (
                    <label
                      key={oIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${4 * scale}px`,
                        fontSize: `${effectiveFontSizePx}px`,
                        fontFamily: effectiveFontFamily,
                        color: effectiveTextColor,
                        cursor: isReadOnly ? 'not-allowed' : 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            formManager.setValue(field.name, [...currentCheckedList, opt]);
                          } else {
                            formManager.setValue(field.name, currentCheckedList.filter((item) => item !== opt));
                          }
                        }}
                        style={{
                          cursor: isReadOnly ? 'not-allowed' : 'pointer',
                          accentColor: fieldColor,
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Single Checkbox */}
            {field.type === 'checkbox' && (
              <div
                id={`tspdf-field-${field.id}`}
                tabIndex={isReadOnly ? -1 : 0}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                style={{
                  ...baseInputStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isReadOnly ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  if (!isReadOnly) {
                    formManager.setValue(field.name, !fieldValue);
                  }
                }}
              >
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(fieldValue)}
                  onChange={(e) => formManager.setValue(field.name, e.target.checked)}
                  style={{
                    width: '75%',
                    height: '75%',
                    cursor: isReadOnly ? 'not-allowed' : 'pointer',
                    accentColor: fieldColor,
                  }}
                />
              </div>
            )}

            {/* Dropdown Select */}
            {field.type === 'dropdown' && (
              <select
                id={`tspdf-field-${field.id}`}
                disabled={isReadOnly}
                value={fieldValue}
                title={isAssignedToOther ? `Locked: Assigned to ${assignee?.name || 'another user'}` : assignee ? `Assigned to: ${assignee.name}` : undefined}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                style={{
                  ...baseInputStyle,
                  padding: `${2 * scale}px ${4 * scale}px`,
                  cursor: isReadOnly ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">{field.placeholder || (field.label ? `-- Select ${field.label} --` : '-- Select --')}</option>
                {(field.options || []).map((opt, oIdx) => (
                  <option key={oIdx} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {/* Radio Group */}
            {field.type === 'radio' && (
              <div
                id={`tspdf-field-${field.id}`}
                tabIndex={isReadOnly ? -1 : 0}
                onFocus={handleFocus}
                onKeyDown={handleInputKeyDown}
                style={{
                  ...baseInputStyle,
                  padding: `${4 * scale}px ${6 * scale}px`,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${2 * scale}px`,
                  cursor: isReadOnly ? 'not-allowed' : 'default',
                }}
              >
                {(field.options || []).map((opt, oIdx) => (
                  <label
                    key={oIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${4 * scale}px`,
                      fontSize: `${effectiveFontSizePx}px`,
                      fontFamily: effectiveFontFamily,
                      color: effectiveTextColor,
                      cursor: isReadOnly ? 'not-allowed' : 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="radio"
                      name={`radio-${field.name}`}
                      disabled={isReadOnly}
                      checked={fieldValue === opt}
                      onChange={() => formManager.setValue(field.name, opt)}
                      style={{
                        cursor: isReadOnly ? 'not-allowed' : 'pointer',
                        accentColor: fieldColor,
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Signature & Digital Signature Interactive Field */}
            {isSignature && (
              <div
                id={`tspdf-field-${field.id}`}
                tabIndex={isReadOnly ? -1 : 0}
                onFocus={handleFocus}
                onKeyDown={(e) => {
                  handleInputKeyDown(e);
                  if (!isReadOnly && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setSigningField(field);
                  }
                }}
                onClick={() => {
                  if (!isReadOnly) {
                    setSigningField(field);
                  }
                }}
                style={{
                  ...baseInputStyle,
                  cursor: isReadOnly ? 'not-allowed' : 'pointer',
                  border: isSigned
                    ? `1.5px solid ${isActive ? fieldColor : '#cbd5e1'}`
                    : `1.5px dashed ${isActive ? fieldColor : fieldColor}`,
                  backgroundColor: isSigned
                    ? (effectiveBgColor || '#ffffff')
                    : isAssignedToOther
                    ? 'rgba(241, 245, 249, 0.8)'
                    : 'rgba(240, 249, 255, 0.5)',
                  padding: `${2 * scale}px ${4 * scale}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  userSelect: 'none',
                }}
                title={isReadOnly ? 'Field is locked' : isSigned ? 'Click to view or change signature' : 'Click to sign'}
              >
                {isSigned && sigVal ? (
                  /* SIGNED STATE */
                  sigVal.type === 'digital' || field.type === 'digital_signature' ? (
                    /* Digital Certificate Seal */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${6 * scale}px`,
                        width: '100%',
                        height: '100%',
                        padding: '1px 2px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: `${26 * scale}px`,
                          height: `${26 * scale}px`,
                          borderRadius: '50%',
                          backgroundColor: '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <ShieldCheck size={Math.max(13, 15 * scale)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', lineHeight: 1.25 }}>
                        <div
                          style={{
                            fontSize: `${Math.max(9.5, 11 * scale)}px`,
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {field.label ? `${field.label}: ` : ''}Digitally signed by {sigVal.signerName || 'Authorized Signer'}
                        </div>
                        <div
                          style={{
                            fontSize: `${Math.max(8, 9 * scale)}px`,
                            color: '#475569',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sigVal.timestamp ? new Date(sigVal.timestamp).toLocaleString('en-GB') : 'Verified'}{' '}
                          {sigVal.reason ? `· ${sigVal.reason}` : ''}
                        </div>
                        {sigVal.certificateHash && (
                          <div
                            style={{
                              fontSize: `${Math.max(7, 8 * scale)}px`,
                              color: '#0369a1',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            SHA-256: {sigVal.certificateHash.slice(0, 16)}...
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Electronic Signature Image */
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      {sigVal.dataUrl || (sigVal as any).imageUrl ? (
                        <img
                          src={sigVal.dataUrl || (sigVal as any).imageUrl}
                          alt="Signature"
                          style={{
                            maxHeight: '75%',
                            maxWidth: '92%',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: `${Math.max(12, 15 * scale)}px`, fontFamily: 'cursive', color: effectiveTextColor }}>
                          {sigVal.signerName || 'Signed'}
                        </span>
                      )}
                      {sigVal.signerName && (
                        <span
                          style={{
                            fontSize: `${Math.max(7.5, 8.5 * scale)}px`,
                            color: '#64748b',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          Digitally signed by {sigVal.signerName}{field.label ? ` · ${field.label}` : ''}
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  /* UNSIGNED PLACEHOLDER STATE */
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Baseline indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '6px',
                        right: '6px',
                        bottom: `${5 * scale}px`,
                        borderBottom: `1.5px dashed ${fieldColor}66`,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: `${Math.max(9, 11 * scale)}px`, color: fieldColor, fontWeight: 'bold' }}>✕</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${5 * scale}px`,
                        color: isAssignedToOther ? '#94a3b8' : fieldColor,
                        fontSize: `${Math.max(9.5, 11 * scale)}px`,
                        fontWeight: 600,
                        zIndex: 2,
                      }}
                    >
                      {field.type === 'digital_signature' ? (
                        <ShieldCheck size={Math.max(12, 14 * scale)} />
                      ) : (
                        <PenTool size={Math.max(12, 14 * scale)} />
                      )}
                      <span>
                        {isAssignedToOther
                          ? `Assigned to ${assignee ? assignee.name : 'other user'}`
                          : `Click to sign ${field.type === 'digital_signature' ? 'digitally' : 'electronically'}`}
                        {field.label && <span style={{ opacity: 0.85, fontWeight: 500 }}> ({field.label})</span>}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Field Properties Configuration Modal */}
      {editingField && (
        <div style={{ pointerEvents: 'auto' }}>
          <FormFieldEditorModal
            field={editingField}
            assignees={assignees}
            onAddAssignee={(user) => formManager.addAssignee(user)}
            onSave={(updates) => {
              formManager.updateField(editingField.id, updates);
              setEditingField(null);
            }}
            onClose={() => setEditingField(null)}
          />
        </div>
      )}

      {/* Signature Capture Modal */}
      {signingField && (
        <div style={{ pointerEvents: 'auto' }}>
          <FormSignatureModal
            field={signingField}
            assignee={assignees.find((a) => a.id === signingField.assigneeId)}
            currentValue={values[signingField.name]}
            defaultSignerName={formManager.getAssignee(currentAssigneeId || undefined)?.name || ''}
            onSave={(val) => {
              formManager.setValue(signingField.name, val);
              setSigningField(null);
            }}
            onClear={() => {
              formManager.setValue(signingField.name, null);
              setSigningField(null);
            }}
            onClose={() => setSigningField(null)}
          />
        </div>
      )}
    </div>
  );
};
