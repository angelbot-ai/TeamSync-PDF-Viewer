/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState } from 'react';
import { X, Edit2, Search } from 'lucide-react';
import { useShortcuts } from '../hooks/useShortcuts';
import type { ActionType, Shortcut } from '../hooks/useShortcuts';

interface SettingsModalProps {
  onClose: () => void;
  watermarkText: string;
  setWatermarkText: (text: string) => void;
}

export default function SettingsModal({ onClose, watermarkText, setWatermarkText }: SettingsModalProps) {
  const { shortcuts, updateShortcut } = useShortcuts();
  const [activeTab, setActiveTab] = useState('Keyboard Shortcuts');
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, action: ActionType) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore standalone modifier keys
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return;

    let keys = [];
    if (e.metaKey || e.ctrlKey) keys.push('COMMAND');
    if (e.shiftKey) keys.push('SHIFT');
    if (e.altKey) keys.push('ALT');
    
    // Normalize key
    let key = e.key.toUpperCase();
    if (key === ' ') key = 'SPACE';
    
    keys.push(key);
    
    
    
    // Map COMMAND back to Meta internally
    const internalCommand = keys.map(k => k === 'COMMAND' ? 'Meta' : k === 'SHIFT' ? 'Shift' : k === 'ALT' ? 'Alt' : k).join('+');
    
    updateShortcut(action, internalCommand);
    setEditingAction(null);
  };

  const formatCommandForDisplay = (cmd: string) => {
    return cmd.replace(/Meta|Ctrl/gi, 'COMMAND').replace(/\+/g, ' + ').toUpperCase();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '4px', width: '800px', height: '600px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--border-color)', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: '200px', borderRight: '1px solid var(--border-color)', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            {['General', 'Keyboard Shortcuts'].map(tab => (
              <div 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ 
                  padding: '12px 24px', 
                  cursor: 'pointer', 
                  backgroundColor: activeTab === tab ? '#eef2ff' : 'transparent', 
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-color)', 
                  fontWeight: activeTab === tab ? 500 : 400 
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          {/* Main Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {activeTab === 'Keyboard Shortcuts' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Command</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '8px', fontWeight: 600, width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shortcuts.map((s: Shortcut) => (
                    <tr key={s.action} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {editingAction === s.action ? (
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Press keys..."
                            onKeyDown={(e) => handleKeyDown(e, s.action)}
                            onBlur={() => setEditingAction(null)}
                            style={{ padding: '4px 8px', width: '150px', border: '2px solid var(--primary)', borderRadius: '4px', outline: 'none' }}
                          />
                        ) : (
                          formatCommandForDisplay(s.command)
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>{s.description}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <button 
                          onClick={() => setEditingAction(s.action)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            

            
            {activeTab === 'General' && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '24px' }}>
                  Content for General settings will go here.
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                    Forensic Watermark
                  </label>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Add a persistent, diagonal text watermark that overlays all document pages.
                  </div>
                  <input 
                    type="text" 
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Leave blank to disable watermark"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
