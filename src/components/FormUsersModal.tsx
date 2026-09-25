/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormUsersModal — dialog to add, edit, and manage form users/roles and their color coding.
 */

import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import type { FormManager } from '../forms/FormManager';
import type { FormAssignee } from '../forms/types';

interface FormUsersModalProps {
  formManager: FormManager;
  onClose: () => void;
  onUserAdded?: (user: FormAssignee) => void;
}

const PRESET_USER_COLORS = [
  '#2563eb', // Blue
  '#9333ea', // Purple
  '#059669', // Emerald
  '#e11d48', // Rose
  '#d97706', // Amber
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#c026d3', // Fuchsia
  '#0d9488', // Teal
  '#475569', // Slate
];

const ROLE_TEMPLATES: Array<{ name: string; users: Array<{ name: string; color: string }> }> = [
  {
    name: '2-Party Agreement',
    users: [
      { name: 'First Party / Signer', color: '#2563eb' },
      { name: 'Second Party / Counter-signer', color: '#9333ea' },
    ],
  },
  {
    name: 'Approval Workflow',
    users: [
      { name: 'Applicant', color: '#2563eb' },
      { name: 'Reviewer / Manager', color: '#9333ea' },
      { name: 'Compliance Officer', color: '#059669' },
    ],
  },
  {
    name: 'Real Estate / Transaction',
    users: [
      { name: 'Buyer / Tenant', color: '#2563eb' },
      { name: 'Seller / Landlord', color: '#9333ea' },
      { name: 'Broker / Agent', color: '#d97706' },
      { name: 'Notary / Witness', color: '#059669' },
    ],
  },
];

export const FormUsersModal: React.FC<FormUsersModalProps> = ({
  formManager,
  onClose,
  onUserAdded,
}) => {
  const [assignees, setAssignees] = useState<FormAssignee[]>(() => formManager.getAssignees());
  const [newUserName, setNewUserName] = useState('');
  const [newUserColor, setNewUserColor] = useState(PRESET_USER_COLORS[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync assignees from FormManager
  useEffect(() => {
    const unsub = formManager.onAssigneesChange((updated) => setAssignees(updated));
    return unsub;
  }, [formManager]);

  const fields = formManager.getFields();

  const handleAddUser = () => {
    const trimmed = newUserName.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a user or role name.');
      return;
    }

    if (assignees.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`A user with the name "${trimmed}" already exists.`);
      return;
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAssignee: FormAssignee = {
      id,
      name: trimmed,
      color: newUserColor,
    };

    formManager.addAssignee(newAssignee);
    onUserAdded?.(newAssignee);

    setNewUserName('');
    // Advance to next preset color
    const nextColorIdx = (PRESET_USER_COLORS.indexOf(newUserColor) + 1) % PRESET_USER_COLORS.length;
    setNewUserColor(PRESET_USER_COLORS[nextColorIdx]);
    setErrorMsg(null);
  };

  const handleRemoveUser = (id: string, name: string) => {
    const assignedCount = fields.filter((f) => f.assigneeId === id).length;
    if (assignedCount > 0) {
      const confirmRemove = window.confirm(
        `"${name}" has ${assignedCount} field(s) assigned. Removing this user will set those fields to "Anyone / Unassigned". Continue?`
      );
      if (!confirmRemove) return;
    }
    formManager.removeAssignee(id);
  };

  const handleApplyTemplate = (template: typeof ROLE_TEMPLATES[0]) => {
    const currentCount = fields.length;
    if (
      currentCount > 0 &&
      !window.confirm(
        `Replace current users with the "${template.name}" role template? Fields assigned to existing users will become unassigned.`
      )
    ) {
      return;
    }

    const newUsers: FormAssignee[] = template.users.map((u, idx) => ({
      id: `user_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
      name: u.name,
      color: u.color,
    }));

    formManager.setAssignees(newUsers);
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
          borderRadius: '10px',
          width: '520px',
          maxWidth: '92vw',
          maxHeight: '90vh',
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
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                Form Users & Roles
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Define who fills each form item with color-coded assignments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Add User Section */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
              Add a New User or Role
            </span>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => {
                  setNewUserName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUser();
                  }
                }}
                placeholder="e.g. Tenant, Inspector, Reviewer, Client..."
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={handleAddUser}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 14px',
                  backgroundColor: 'var(--primary, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={15} /> Add User
              </button>
            </div>

            {/* Color Selection Palette */}
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Identifying Color:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_USER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewUserColor(c)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: newUserColor === c ? '2.5px solid #0f172a' : '1.5px solid #cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {newUserColor === c && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
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
                    title="Choose custom color"
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Custom</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>
                {errorMsg}
              </span>
            )}
          </div>

          {/* Current Assignees List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                Current Users ({assignees.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Click name or color to edit
              </span>
            </div>

            {assignees.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                No users configured. Add a user above or pick a template below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignees.map((user) => {
                  const assignedCount = fields.filter((f) => f.assigneeId === user.id).length;

                  return (
                    <div
                      key={user.id}
                      className="tspdf-user-row"
                      data-user-name={user.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        gap: '10px',
                      }}
                    >
                      {/* Left: Color dot & Editable Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="color"
                            value={user.color}
                            onChange={(e) => formManager.updateAssignee(user.id, { color: e.target.value })}
                            style={{
                              position: 'absolute',
                              opacity: 0,
                              width: '100%',
                              height: '100%',
                              cursor: 'pointer',
                            }}
                            title="Click to change color"
                          />
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: user.color,
                              border: '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                            }}
                          />
                        </div>

                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                          {user.name}
                        </span>
                      </div>

                      {/* Right: Field Count Badge & Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            backgroundColor: `${user.color}1a`,
                            color: user.color,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {assignedCount} {assignedCount === 1 ? 'field' : 'fields'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveUser(user.id, user.name)}
                          title={`Delete ${user.name}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Role Templates */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              <Sparkles size={13} color="#f59e0b" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Quick Role Presets
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ROLE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  + {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f8fafc',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
