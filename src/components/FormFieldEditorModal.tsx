/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormFieldEditorModal — configuration dialog for form field properties in Builder mode.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { FormField, DateTimeFormat } from '../forms/types';

interface FormFieldEditorModalProps {
  field: FormField;
  onSave: (updated: Partial<FormField>) => void;
  onClose: () => void;
}

export const FormFieldEditorModal: React.FC<FormFieldEditorModalProps> = ({ field, onSave, onClose }) => {
  const [name, setName] = useState(field.name || '');
  const [label, setLabel] = useState(field.label || '');
  const [placeholder, setPlaceholder] = useState(field.placeholder || '');
  const [required, setRequired] = useState(field.required || false);
  const [defaultValue, setDefaultValue] = useState(field.defaultValue !== undefined ? String(field.defaultValue) : '');
  const [dateFormat, setDateFormat] = useState<DateTimeFormat>(field.dateFormat || 'datetime');
  const [options, setOptions] = useState<string[]>(field.options ? [...field.options] : ['Option 1', 'Option 2']);
  const [newOptionText, setNewOptionText] = useState('');

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

  const handleSave = () => {
    const sanitizedName = (name.trim() || field.name).replace(/\s+/g, '_');
    onSave({
      name: sanitizedName,
      label: label.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
      required,
      defaultValue: defaultValue !== '' ? defaultValue : undefined,
      dateFormat: field.type === 'datetime' ? dateFormat : undefined,
      options: hasOptions ? options : undefined,
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
          width: '460px',
          maxWidth: '90vw',
          maxHeight: '85vh',
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
            padding: '16px 20px',
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

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Field Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Field Key Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. employee_name"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Unique identifier used in form data export</span>
          </div>

          {/* Label */}
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

          {/* Placeholder (for text, textbox & textarea) */}
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

          {/* Date format (for datetime) */}
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
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                }}
              >
                <option value="datetime">Date & Time</option>
                <option value="date">Date Only</option>
                <option value="time">Time Only</option>
              </select>
            </div>
          )}

          {/* Options Manager (for checklist, dropdown, radio) */}
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
                    borderRadius: '4px',
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
                    backgroundColor: 'var(--primary, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
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
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  backgroundColor: '#f9fafb',
                }}
              >
                {options.length === 0 ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                    No items yet. Add at least one item.
                  </div>
                ) : (
                  options.map((opt, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderBottom: idx < options.length - 1 ? '1px solid #e5e7eb' : 'none',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#374151' }}>{opt}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveOption(idx, 'up')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: idx === 0 ? 'default' : 'pointer',
                            color: idx === 0 ? '#d1d5db' : '#6b7280',
                            padding: '2px',
                          }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === options.length - 1}
                          onClick={() => handleMoveOption(idx, 'down')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: idx === options.length - 1 ? 'default' : 'pointer',
                            color: idx === options.length - 1 ? '#d1d5db' : '#6b7280',
                            padding: '2px',
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '2px',
                          }}
                        >
                          <Trash2 size={14} />
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
