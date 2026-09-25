/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFieldEditorModal — configuration dialog for form field properties, styling, assignments, and flow.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, User, Palette, Sliders, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, PenTool, ShieldCheck } from 'lucide-react';
import type { FormField, DateTimeFormat, FormAssignee, SignatureType } from '../forms/types';
import { DEFAULT_ASSIGNEES } from '../forms/FormManager';

interface FormFieldEditorModalProps {
  field: FormField;
  assignees?: FormAssignee[];
  onAddAssignee?: (assignee: FormAssignee) => void;
  onSave: (updated: Partial<FormField>) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#0f172a', // Slate 900
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#dc2626', // Red
  '#d97706', // Amber
  '#475569', // Slate 600
  '#ffffff', // White
];

const PRESET_BG_COLORS = [
  '#ffffff',
  '#f8fafc',
  '#eff6ff',
  '#faf5ff',
  '#f0fdf4',
  '#fffbeb',
  '#fef2f2',
  'transparent',
];

export const FormFieldEditorModal: React.FC<FormFieldEditorModalProps> = ({
  field,
  assignees = DEFAULT_ASSIGNEES,
  onAddAssignee,
  onSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'style'>('general');
  const [localAssignees, setLocalAssignees] = useState<FormAssignee[]>(assignees);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState('#2563eb');

  React.useEffect(() => {
    setLocalAssignees(assignees);
  }, [assignees]);

  // General state
  const [name, setName] = useState(field.name || '');
  const [label, setLabel] = useState(field.label || '');
  const [placeholder, setPlaceholder] = useState(field.placeholder || '');
  const [required, setRequired] = useState(field.required || false);
  const [defaultValue, setDefaultValue] = useState(field.defaultValue !== undefined ? String(field.defaultValue) : '');
  const [dateFormat, setDateFormat] = useState<DateTimeFormat>(field.dateFormat || 'datetime');
  const [options, setOptions] = useState<string[]>(field.options ? [...field.options] : ['Option 1', 'Option 2']);
  const [newOptionText, setNewOptionText] = useState('');

  // Multi-user & Flow state
  const [assigneeId, setAssigneeId] = useState(field.assigneeId || '');
  const [flowOrder, setFlowOrder] = useState<string>(field.flowOrder !== undefined ? String(field.flowOrder) : '');

  // Signature state
  const isSignatureField = field.type === 'signature' || field.type === 'digital_signature';
  const [signatureType, setSignatureType] = useState<SignatureType>(
    field.signatureType || (field.type === 'digital_signature' ? 'digital' : 'electronic')
  );
  const [signTagText, setSignTagText] = useState(
    field.signTagText || (field.type === 'digital_signature' ? 'DIGITAL SIGN' : 'SIGN HERE')
  );

  // Styling state
  const [textColor, setTextColor] = useState(field.textColor || '#0f172a');
  const [backgroundColor, setBackgroundColor] = useState(field.backgroundColor || '#ffffff');
  const [borderColor, setBorderColor] = useState(field.borderColor || '#94a3b8');
  const [borderWidth, setBorderWidth] = useState<number>(field.borderWidth || 1);
  const [borderRadius, setBorderRadius] = useState<number>(field.borderRadius || 3);
  const [fontFamily, setFontFamily] = useState(field.fontFamily || 'inherit');
  const [fontSize, setFontSize] = useState<number>(field.fontSize || 13);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>(field.fontWeight || 'normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>(field.fontStyle || 'normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(field.textAlign || 'left');

  const hasOptions = ['checklist', 'dropdown', 'radio'].includes(field.type);

  const handleAddOption = () => {
    const trimmed = newOptionText.trim();
    if (!trimmed) return;
    setOptions([...options, trimmed]);
    setNewOptionText('');
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleMoveOption = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= options.length) return;
    const copy = [...options];
    const item = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = item;
    setOptions(copy);
  };

  const handleQuickAddUser = () => {
    const trimmed = newUserName.trim();
    if (!trimmed) return;
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAssignee: FormAssignee = {
      id,
      name: trimmed,
      color: newUserColor,
    };
    onAddAssignee?.(newAssignee);
    setLocalAssignees((prev) => [...prev, newAssignee]);
    setAssigneeId(id);
    setBorderColor(newUserColor);
    setNewUserName('');
    setIsAddingUser(false);
  };

  const handleSave = () => {
    const sanitizedName = (name.trim() || field.name).replace(/\s+/g, '_');
    const parsedFlowOrder = flowOrder.trim() !== '' ? parseInt(flowOrder.trim(), 10) : undefined;

    onSave({
      name: sanitizedName,
      label: label.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      required,
      defaultValue: defaultValue !== '' ? defaultValue : undefined,
      dateFormat: field.type === 'datetime' ? dateFormat : undefined,
      options: hasOptions ? options : undefined,
      assigneeId: assigneeId || undefined,
      flowOrder: Number.isFinite(parsedFlowOrder) ? parsedFlowOrder : undefined,
      type: isSignatureField ? (signatureType === 'digital' ? 'digital_signature' : 'signature') : field.type,
      signatureType: isSignatureField ? signatureType : undefined,
      signTagText: isSignatureField ? (signTagText.trim() || undefined) : undefined,
      textColor,
      backgroundColor,
      borderColor,
      borderWidth,
      borderRadius,
      fontFamily: fontFamily !== 'inherit' ? fontFamily : undefined,
      fontSize,
      fontWeight,
      fontStyle,
      textAlign,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          width: '500px',
          maxWidth: '92vw',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f9fafb',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              Field Properties
            </h3>
            <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
              Type: {field.type === 'checklist' ? 'Check List' : field.type === 'datetime' ? 'Date & Time' : field.type}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc',
            padding: '0 16px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              borderBottom: activeTab === 'general' ? '2px solid #0284c7' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'general' ? '#0284c7' : '#64748b',
              cursor: 'pointer',
            }}
          >
            <Sliders size={14} /> General & Assignment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('style')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              borderBottom: activeTab === 'style' ? '2px solid #0284c7' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'style' ? '#0284c7' : '#64748b',
              cursor: 'pointer',
            }}
          >
            <Palette size={14} /> Style & Appearance
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {activeTab === 'general' ? (
            <>
              {/* Field Key Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Field Key Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. applicant_name"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>Unique key identifier used when extracting form values</span>
              </div>

              {/* Display Label */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Display Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Full Legal Name"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Signature Field Settings & 'Sign Here' Tag */}
              {isSignatureField && (
                <div
                  style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PenTool size={15} color="#0284c7" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>
                      Signature & "Sign Here" Tag Configuration
                    </span>
                  </div>

                  {/* Signature Type Switch */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>
                      Signature Mode
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureType('electronic');
                          if (signTagText === 'DIGITAL SIGN') setSignTagText('SIGN HERE');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '5px',
                          border: '1px solid',
                          borderColor: signatureType === 'electronic' ? '#0284c7' : '#cbd5e1',
                          backgroundColor: signatureType === 'electronic' ? '#ffffff' : '#f8fafc',
                          color: signatureType === 'electronic' ? '#0284c7' : '#64748b',
                          fontWeight: signatureType === 'electronic' ? 600 : 400,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                      >
                        <PenTool size={13} /> Electronic Signature
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureType('digital');
                          if (signTagText === 'SIGN HERE') setSignTagText('DIGITAL SIGN');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '5px',
                          border: '1px solid',
                          borderColor: signatureType === 'digital' ? '#0284c7' : '#cbd5e1',
                          backgroundColor: signatureType === 'digital' ? '#ffffff' : '#f8fafc',
                          color: signatureType === 'digital' ? '#0284c7' : '#64748b',
                          fontWeight: signatureType === 'digital' ? 600 : 400,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                      >
                        <ShieldCheck size={13} /> Digital Certificate
                      </button>
                    </div>
                  </div>

                  {/* "Sign Here" Tag Text */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#334155', marginBottom: '4px' }}>
                      "Sign Here" Flag Tag Text
                    </label>
                    <input
                      type="text"
                      value={signTagText}
                      onChange={(e) => setSignTagText(e.target.value)}
                      placeholder="e.g. SIGN HERE, INITIALS, WITNESS..."
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                      Prominent visual arrow flag displayed on the signature box to guide respondents where to sign.
                    </span>
                  </div>
                </div>
              )}

              {/* Multi-User Assignee Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#374151', margin: 0 }}>
                    <User size={14} color="#0284c7" /> Assign To (Multi-User Role)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(!isAddingUser)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    {isAddingUser ? 'Cancel' : '+ New User'}
                  </button>
                </div>

                {isAddingUser && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <input
                      type="color"
                      value={newUserColor}
                      onChange={(e) => setNewUserColor(e.target.value)}
                      style={{
                        width: '24px',
                        height: '24px',
                        padding: 0,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title="Choose user color"
                    />
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. Tenant, Inspector..."
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddUser();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddUser}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Assign Role
                    </button>
                  </div>
                )}

                <select
                  value={assigneeId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAssigneeId(val);
                    const selected = localAssignees.find((a) => a.id === val);
                    if (selected) {
                      setBorderColor(selected.color);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="">-- Anyone / Unassigned --</option>
                  {localAssignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.color})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Restricts filling of this field in View mode to the assigned user with color-coded badges.
                </span>
              </div>

              {/* Flow Order (Step in Form Filling Flow) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Flow Order (Step in Form Filling Sequence)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={flowOrder}
                  onChange={(e) => setFlowOrder(e.target.value)}
                  placeholder="e.g. 1, 2, 3 (Leave empty for default page position)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Defines the sequence order when a user navigates using "Next Field" or the Tab key.
                </span>
              </div>

              {/* Placeholder (for text, textbox, textarea) */}
              {['text', 'textbox', 'textarea', 'datetime'].includes(field.type) && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={placeholder}
                    onChange={(e) => setPlaceholder(e.target.value)}
                    placeholder="e.g. Enter name as shown on ID"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Date Format (if datetime) */}
              {field.type === 'datetime' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    Picker Mode
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value as DateTimeFormat)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="datetime">Date & Time (YYYY-MM-DDTHH:MM)</option>
                    <option value="date">Date Only (YYYY-MM-DD)</option>
                    <option value="time">Time Only (HH:MM)</option>
                  </select>
                </div>
              )}

              {/* Options Management (checklist, dropdown, radio) */}
              {hasOptions && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    {field.type === 'checklist' ? 'Checklist Items' : 'Choices / Options'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="New item / option text"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      backgroundColor: '#fafafa',
                    }}
                  >
                    {options.length === 0 ? (
                      <span style={{ fontSize: '12px', color: '#9ca3af', padding: '8px', textAlign: 'center' }}>
                        No options added yet.
                      </span>
                    ) : (
                      options.map((opt, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, 'up')}
                              disabled={idx === 0}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: idx === 0 ? 'default' : 'pointer',
                                padding: '2px',
                                color: idx === 0 ? '#d1d5db' : '#6b7280',
                              }}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(idx, 'down')}
                              disabled={idx === options.length - 1}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: idx === options.length - 1 ? 'default' : 'pointer',
                                padding: '2px',
                                color: idx === options.length - 1 ? '#d1d5db' : '#6b7280',
                              }}
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                color: '#ef4444',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Required toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="field-required"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="field-required" style={{ fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                  Required field (mandatory)
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Typography */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  <Type size={14} color="#0284c7" /> Font & Typography
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Font Family</span>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '12px',
                        backgroundColor: '#ffffff',
                        marginTop: '2px',
                      }}
                    >
                      <option value="inherit">Default / Sans-Serif</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="'Times New Roman', serif">Times New Roman (Serif)</option>
                      <option value="'Courier New', monospace">Courier (Monospace)</option>
                      <option value="'Dancing Script', cursive">Dancing Script (Cursive)</option>
                    </select>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Font Size</span>
                    <select
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '12px',
                        backgroundColor: '#ffffff',
                        marginTop: '2px',
                      }}
                    >
                      <option value={10}>10 pt (Small)</option>
                      <option value={12}>12 pt (Standard)</option>
                      <option value={14}>14 pt (Medium)</option>
                      <option value={16}>16 pt (Large)</option>
                      <option value={18}>18 pt (X-Large)</option>
                      <option value={22}>22 pt (Heading)</option>
                    </select>
                  </div>
                </div>

                {/* Bold, Italic & Alignment Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: fontWeight === 'bold' ? '#e0f2fe' : '#ffffff',
                      color: fontWeight === 'bold' ? '#0369a1' : '#374151',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Bold size={13} /> Bold
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: fontStyle === 'italic' ? '#e0f2fe' : '#ffffff',
                      color: fontStyle === 'italic' ? '#0369a1' : '#374151',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Italic size={13} /> Italic
                  </button>

                  <div style={{ width: '1px', height: '18px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setTextAlign(align)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        backgroundColor: textAlign === align ? '#e0f2fe' : '#ffffff',
                        color: textAlign === align ? '#0369a1' : '#64748b',
                        cursor: 'pointer',
                      }}
                      title={`Align ${align}`}
                    >
                      {align === 'left' && <AlignLeft size={13} />}
                      {align === 'center' && <AlignCenter size={13} />}
                      {align === 'right' && <AlignRight size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Text Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTextColor(c)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: textColor === c ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          boxShadow: textColor === c ? '0 0 0 1px #0284c7' : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={textColor.startsWith('#') ? textColor : '#0f172a'}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Background / Fill Color */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Background Fill Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {PRESET_BG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBackgroundColor(c)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '4px',
                          backgroundColor: c === 'transparent' ? '#ffffff' : c,
                          border: backgroundColor === c ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        title={c}
                      >
                        {c === 'transparent' && (
                          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1.5px', backgroundColor: '#ef4444', transform: 'rotate(45deg)' }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={backgroundColor.startsWith('#') ? backgroundColor : '#ffffff'}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    onClick={() => setBackgroundColor('transparent')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: backgroundColor === 'transparent' ? '#e0f2fe' : '#f1f5f9',
                      color: backgroundColor === 'transparent' ? '#0369a1' : '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Transparent
                  </button>
                </div>
              </div>

              {/* Borders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Border Color</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <input
                      type="color"
                      value={borderColor.startsWith('#') ? borderColor : '#94a3b8'}
                      onChange={(e) => setBorderColor(e.target.value)}
                      style={{ width: '26px', height: '26px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={borderColor}
                      onChange={(e) => setBorderColor(e.target.value)}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Border Width & Radius</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                    <select
                      value={borderWidth}
                      onChange={(e) => setBorderWidth(parseInt(e.target.value, 10))}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#ffffff' }}
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                    </select>
                    <select
                      value={borderRadius}
                      onChange={(e) => setBorderRadius(parseInt(e.target.value, 10))}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#ffffff' }}
                    >
                      <option value={0}>Square</option>
                      <option value={4}>4px</option>
                      <option value={8}>8px</option>
                      <option value={16}>Pill</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Style Live Preview</span>
                <div
                  style={{
                    padding: '8px 12px',
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    fontStyle,
                    textAlign,
                    color: textColor,
                    backgroundColor: backgroundColor === 'transparent' ? '#ffffff' : backgroundColor,
                    border: `${borderWidth}px solid ${borderColor}`,
                    borderRadius: `${borderRadius}px`,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {placeholder || label || 'Sample Form Input Text'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary, #0284c7)',
              fontSize: '13px',
              fontWeight: 500,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
