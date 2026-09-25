/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFieldLayer — renders form builder controls (Builder mode) or interactive HTML inputs (Filler mode).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Trash2, Copy } from 'lucide-react';
import type { FormField, FormToolType, FormDataRecord } from '../forms/types';
import type { FormManager } from '../forms/FormManager';
import { FormFieldEditorModal } from './FormFieldEditorModal';
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
}) => {
  const [fields, setFields] = useState<FormField[]>(() => formManager.getFieldsForPage(pageNum));
  const [values, setValues] = useState<FormDataRecord>(() => formManager.getValues());
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<FormField | null>(null);

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

  // Sync fields and values from FormManager
  useEffect(() => {
    const unsubFields = formManager.onFieldsChange(() => {
      setFields(formManager.getFieldsForPage(pageNum));
    });
    const unsubData = formManager.onDataChange((newValues) => {
      setValues(newValues);
    });
    return () => {
      unsubFields();
      unsubData();
    };
  }, [formManager, pageNum]);

  // Keyboard deletion of selected field
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
        formManager.updateField(fieldId, { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }, false);
      }
      return;
    }

    if (creationRect) {
      const pt = getPdfCoordinates(e);
      setCreationRect((prev) => (prev ? { ...prev, curX: pt.x, curY: pt.y } : null));
    }
  }, [creationRect, getPdfCoordinates, basePageWidth, basePageHeight, formManager]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }

    if (creationRect && isCreating && activeTool) {
      const minX = Math.min(creationRect.startX, creationRect.curX);
      const minY = Math.min(creationRect.startY, creationRect.curY);
      const w = Math.abs(creationRect.curX - creationRect.startX);
      const h = Math.abs(creationRect.curY - creationRect.startY);

      const defaultDims: Record<string, { w: number; h: number }> = {
        textbox: { w: 180, h: 36 },
        textarea: { w: 220, h: 72 },
        datetime: { w: 180, h: 36 },
        checklist: { w: 180, h: 90 },
        dropdown: { w: 160, h: 36 },
        radio: { w: 160, h: 70 },
      };

      const dim = defaultDims[activeTool] || { w: 160, h: 36 };
      const finalW = w > 15 ? Math.round(w) : dim.w;
      const finalH = h > 15 ? Math.round(h) : dim.h;
      const finalX = Math.round(w > 15 ? minX : creationRect.startX);
      const finalY = Math.round(h > 15 ? minY : creationRect.startY);

      const fieldId = newId();
      const count = formManager.getFields().filter((f) => f.type === activeTool || (activeTool === 'textbox' && (f.type === 'text' || (f.type as string) === 'textbox'))).length + 1;
      const resolvedType = (activeTool === 'textbox' ? 'text' : activeTool) as FormField['type'];
      const newField: FormField = {
        id: fieldId,
        name: `${activeTool}_${count}`,
        type: resolvedType,
        pageIndex: pageNum,
        x: Math.max(0, Math.min(basePageWidth - finalW, finalX)),
        y: Math.max(0, Math.min(basePageHeight - finalH, finalY)),
        width: finalW,
        height: finalH,
        label: `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} ${count}`,
        placeholder: ['textbox', 'text', 'textarea'].includes(activeTool) ? 'Enter text...' : undefined,
        required: false,
        options: ['checklist', 'dropdown', 'radio'].includes(activeTool) ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
        dateFormat: activeTool === 'datetime' ? 'datetime' : undefined,
      };

      formManager.addField(newField);
      setSelectedFieldId(fieldId);
      setActiveTool('select');
      setCreationRect(null);
    }
  }, [creationRect, isCreating, activeTool, pageNum, basePageWidth, basePageHeight, formManager, setActiveTool]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Start field resize
  const handleStartResize = (field: FormField, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  // Start field move
  const handleStartMove = (field: FormField, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  const handleDuplicateField = (field: FormField, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: FormField = {
      ...field,
      id: newId(),
      name: `${field.name}_copy`,
      x: Math.min(basePageWidth - field.width, field.x + 20),
      y: Math.min(basePageHeight - field.height, field.y + 20),
    };
    formManager.addField(dup);
    setSelectedFieldId(dup.id);
  };

  const handleDeleteField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    formManager.deleteField(id);
    if (selectedFieldId === id) setSelectedFieldId(null);
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
                backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'rgba(240, 249, 255, 0.75)',
                border: isSelected ? '2px solid #0284c7' : '1px dashed #38bdf8',
                borderRadius: '4px',
                cursor: 'move',
                zIndex: isSelected ? 25 : 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4px 6px',
                boxSizing: 'border-box',
                boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.3)' : 'none',
              }}
            >
              {/* Field Label & Type Tag */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: `${Math.max(10, 11 * scale)}px`,
                    fontWeight: 600,
                    color: '#0369a1',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {field.label || field.name}
                  {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                </span>
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
                      color: '#0284c7',
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
                      border: '1.5px solid #0284c7',
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
        const isReadOnly = !canFillForms || field.readOnly;
        const fontSizePx = Math.max(11, 13 * scale);

        return (
          <div
            key={field.id}
            style={{
              position: 'absolute',
              left: `${rot.x * scale}px`,
              top: `${rot.y * scale}px`,
              width: `${rot.width * scale}px`,
              height: `${rot.height * scale}px`,
              zIndex: 16,
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}
          >
            {/* Textbox Input */}
            {(field.type === 'text' || (field.type as string) === 'textbox') && (
              <input
                type="text"
                disabled={isReadOnly}
                value={fieldValue}
                placeholder={field.placeholder || field.label || ''}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontSizePx}px`,
                  padding: `${2 * scale}px ${6 * scale}px`,
                  border: '1.5px solid #94a3b8',
                  borderRadius: '3px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                }}
              />
            )}

            {/* Text Area Input */}
            {field.type === 'textarea' && (
              <textarea
                disabled={isReadOnly}
                value={fieldValue}
                placeholder={field.placeholder || field.label || ''}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontSizePx}px`,
                  padding: `${4 * scale}px ${6 * scale}px`,
                  border: '1px solid #cbd5e1',
                  borderRadius: '3px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}

            {/* Date and Time Picker */}
            {field.type === 'datetime' && (
              <input
                type={field.dateFormat === 'date' ? 'date' : field.dateFormat === 'time' ? 'time' : 'datetime-local'}
                disabled={isReadOnly}
                value={fieldValue}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontSizePx}px`,
                  padding: `${2 * scale}px ${6 * scale}px`,
                  border: '1px solid #cbd5e1',
                  borderRadius: '3px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            )}

            {/* Check List (Multi-item list with checkboxes) */}
            {field.type === 'checklist' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '3px',
                  padding: `${4 * scale}px ${6 * scale}px`,
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${2 * scale}px`,
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
                        fontSize: `${fontSizePx}px`,
                        color: '#334155',
                        cursor: isReadOnly ? 'default' : 'pointer',
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
                          cursor: isReadOnly ? 'default' : 'pointer',
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
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                    cursor: isReadOnly ? 'default' : 'pointer',
                  }}
                />
              </div>
            )}

            {/* Dropdown Select */}
            {field.type === 'dropdown' && (
              <select
                disabled={isReadOnly}
                value={fieldValue}
                onChange={(e) => formManager.setValue(field.name, e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${fontSizePx}px`,
                  padding: `${2 * scale}px ${4 * scale}px`,
                  border: '1px solid #cbd5e1',
                  borderRadius: '3px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                <option value="">{field.placeholder || '-- Select --'}</option>
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
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '3px',
                  padding: `${4 * scale}px ${6 * scale}px`,
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${2 * scale}px`,
                }}
              >
                {(field.options || []).map((opt, oIdx) => (
                  <label
                    key={oIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${4 * scale}px`,
                      fontSize: `${fontSizePx}px`,
                      color: '#334155',
                      cursor: isReadOnly ? 'default' : 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="radio"
                      name={`radio-${field.name}`}
                      disabled={isReadOnly}
                      checked={fieldValue === opt}
                      onChange={() => formManager.setValue(field.name, opt)}
                      style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Field Properties Configuration Modal */}
      {editingField && (
        <FormFieldEditorModal
          field={editingField}
          onSave={(updates) => {
            formManager.updateField(editingField.id, updates);
            setEditingField(null);
          }}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
};
