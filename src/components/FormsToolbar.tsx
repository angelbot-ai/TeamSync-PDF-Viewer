/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormsToolbar — sub-toolbar rendered when the 'Forms' builder tab is active.
 */

import React, { useRef } from 'react';
import {
  Undo2,
  Redo2,
  MousePointer,
  Type,
  AlignLeft,
  Calendar,
  ListChecks,
  ChevronDownSquare,
  CircleDot,
  Trash2,
  Download,
  Upload,
  Eye,
} from 'lucide-react';
import type { FormToolType } from '../forms/types';
import type { FormManager } from '../forms/FormManager';

interface FormsToolbarProps {
  activeTool: FormToolType;
  setActiveTool: (tool: FormToolType) => void;
  formManager: FormManager;
  onSwitchToView?: () => void;
}

export const FormsToolbar: React.FC<FormsToolbarProps> = ({
  activeTool,
  setActiveTool,
  formManager,
  onSwitchToView,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSchema = () => {
    const json = formManager.exportFieldsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'form-schema.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSchema = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        formManager.importFieldsJson(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = () => {
    if (formManager.getFields().length === 0) return;
    if (window.confirm('Are you sure you want to remove all form fields from this document?')) {
      formManager.clearFields();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        height: '42px',
        userSelect: 'none',
        fontSize: '13px',
      }}
    >
      {/* Left section: History and Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Undo / Redo */}
        <ToolButton
          icon={<Undo2 size={16} />}
          label="Undo"
          disabled={!formManager.canUndo}
          onClick={() => formManager.undo()}
        />
        <ToolButton
          icon={<Redo2 size={16} />}
          label="Redo"
          disabled={!formManager.canRedo}
          onClick={() => formManager.redo()}
        />

        <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 6px' }} />

        {/* Selection tool */}
        <ToolButton
          icon={<MousePointer size={16} />}
          label="Select & Move Field"
          active={activeTool === 'select' || activeTool === null}
          onClick={() => setActiveTool('select')}
        />

        <div style={{ width: '1px', height: '20px', backgroundColor: '#e5e7eb', margin: '0 6px' }} />

        {/* Form Field Creation Tools */}
        <ToolButton
          icon={<Type size={16} />}
          label="Textbox"
          active={activeTool === 'textbox'}
          onClick={() => setActiveTool('textbox')}
        />
        <ToolButton
          icon={<AlignLeft size={16} />}
          label="Text Area"
          active={activeTool === 'textarea'}
          onClick={() => setActiveTool('textarea')}
        />
        <ToolButton
          icon={<Calendar size={16} />}
          label="Date & Time Picker"
          active={activeTool === 'datetime'}
          onClick={() => setActiveTool('datetime')}
        />
        <ToolButton
          icon={<ListChecks size={16} />}
          label="Check List"
          active={activeTool === 'checklist'}
          onClick={() => setActiveTool('checklist')}
        />
        <ToolButton
          icon={<ChevronDownSquare size={16} />}
          label="Dropdown"
          active={activeTool === 'dropdown'}
          onClick={() => setActiveTool('dropdown')}
        />
        <ToolButton
          icon={<CircleDot size={16} />}
          label="Radio Group"
          active={activeTool === 'radio'}
          onClick={() => setActiveTool('radio')}
        />
      </div>

      {/* Right section: Builder Utilities & Test Form */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportSchema}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import Form Schema (JSON)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Upload size={14} /> Import
        </button>

        <button
          type="button"
          onClick={handleExportSchema}
          title="Export Form Schema (JSON)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Download size={14} /> Export
        </button>

        <button
          type="button"
          onClick={handleClearAll}
          title="Clear all fields"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #fca5a5',
            borderRadius: '4px',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Trash2 size={14} /> Clear All
        </button>

        {onSwitchToView && (
          <button
            type="button"
            onClick={onSwitchToView}
            title="Preview and fill this form in View mode"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              backgroundColor: '#e0f2fe',
              border: '1px solid #7dd3fc',
              borderRadius: '4px',
              color: '#0369a1',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Eye size={14} /> Test Form
          </button>
        )}
      </div>
    </div>
  );
};

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, active = false, disabled = false, onClick }) => {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        backgroundColor: active ? '#e0f2fe' : 'transparent',
        border: active ? '1px solid var(--primary, #0284c7)' : '1px solid transparent',
        borderRadius: '4px',
        color: active ? 'var(--primary, #0284c7)' : disabled ? '#9ca3af' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 400,
        fontSize: '12px',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};
