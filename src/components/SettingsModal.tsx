/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState, useMemo } from 'react';
import { X, Edit2, Search, RotateCcw, Check } from 'lucide-react';
import { useShortcuts, parseCommandString } from '../hooks/useShortcuts';
import type { ActionType, Shortcut } from '../hooks/useShortcuts';

interface SettingsModalProps {
  onClose: () => void;
  watermarkText: string;
  setWatermarkText: (text: string) => void;
}

export default function SettingsModal({ onClose, watermarkText, setWatermarkText }: SettingsModalProps) {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [activeTab, setActiveTab] = useState<'General' | 'Keyboard Shortcuts'>('Keyboard Shortcuts');
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent, action: ActionType) => {
    e.preventDefault();
    e.stopPropagation();

    // Escape cancels editing
    if (e.key === 'Escape') {
      setEditingAction(null);
      return;
    }

    // Ignore standalone modifier keys
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return;

    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push('Meta');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key === 'Backspace' || key === 'Delete') {
      key = 'Delete';
    } else if (e.shiftKey && (key === '+' || e.code === 'Equal')) {
      key = '=';
    } else if (e.shiftKey && (key === '_' || e.code === 'Minus')) {
      key = '-';
    } else if (key.length === 1) {
      key = key.toUpperCase();
    }

    parts.push(key);
    const internalCommand = parts.join('+');

    updateShortcut(action, internalCommand);
    setEditingAction(null);
  };

  const renderCommandBadges = (cmd: string) => {
    if (!cmd) return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>None</span>;
    const parsed = parseCommandString(cmd);
    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '');
    const tokens: string[] = [];

    if (parsed.meta) tokens.push(isMac ? '⌘' : 'Ctrl');
    if (parsed.alt) tokens.push(isMac ? '⌥' : 'Alt');
    if (parsed.shift) tokens.push(isMac ? '⇧' : 'Shift');
    if (parsed.key) {
      let k = parsed.key.toUpperCase();
      if (k === 'DELETE') k = isMac ? '⌫ Delete' : 'Del';
      tokens.push(k);
    }

    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        {tokens.map((t, idx) => (
          <kbd
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 7px',
              fontSize: '11.5px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontWeight: 600,
              color: '#1f2937',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
              minWidth: '20px',
              textAlign: 'center',
            }}
          >
            {t}
          </kbd>
        ))}
      </div>
    );
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredShortcuts = useMemo(() => {
    if (!query) return shortcuts;
    return shortcuts.filter((s: Shortcut) => {
      const descMatch = s.description.toLowerCase().includes(query);
      const actionMatch = s.action.toLowerCase().includes(query);
      const cmdMatch = s.command.toLowerCase().includes(query);
      return descMatch || actionMatch || cmdMatch;
    });
  }, [shortcuts, query]);

  const generalMatches = useMemo(() => {
    if (!query) return true;
    return 'forensic watermark persistent diagonal text overlay'.toLowerCase().includes(query) ||
           Boolean(watermarkText && watermarkText.toLowerCase().includes(query));
  }, [query, watermarkText]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '800px', height: '620px', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-color)' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search shortcuts & settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 36px 9px 36px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
                backgroundColor: '#fff',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0
                }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar Tabs */}
          <div style={{ width: '200px', borderRight: '1px solid var(--border-color)', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            {(['General', 'Keyboard Shortcuts'] as const).map(tab => {
              const badgeCount = tab === 'Keyboard Shortcuts' ? (query ? filteredShortcuts.length : null) : (query && generalMatches ? 1 : null);
              return (
                <div 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{ 
                    padding: '12px 20px', 
                    cursor: 'pointer', 
                    backgroundColor: activeTab === tab ? '#eef2ff' : 'transparent', 
                    color: activeTab === tab ? 'var(--primary)' : 'var(--text-color)', 
                    fontWeight: activeTab === tab ? 600 : 400,
                    fontSize: '13.5px',
                    borderLeft: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{tab}</span>
                  {badgeCount !== null && (
                    <span style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: activeTab === tab ? 'var(--primary)' : '#e5e7eb',
                      color: activeTab === tab ? '#fff' : '#4b5563',
                      fontWeight: 600
                    }}>
                      {badgeCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {activeTab === 'Keyboard Shortcuts' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {query ? `${filteredShortcuts.length} of ${shortcuts.length} shortcuts` : `${shortcuts.length} shortcuts available`}
                  </span>
                  <button
                    onClick={resetShortcuts}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="Reset all shortcuts to defaults"
                  >
                    <RotateCcw size={13} />
                    Reset to Defaults
                  </button>
                </div>

                {filteredShortcuts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div>No shortcuts matching &ldquo;{searchQuery}&rdquo;</div>
                    {generalMatches && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={() => setActiveTab('General')}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, textDecoration: 'underline' }}
                        >
                          Matching setting found in General tab &rarr;
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600, width: '220px' }}>Shortcut</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Description</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, width: '70px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShortcuts.map((s: Shortcut) => (
                        <tr key={s.action} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 12px' }}>
                            {editingAction === s.action ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input 
                                  autoFocus
                                  type="text"
                                  placeholder="Press key combo..."
                                  onKeyDown={(e) => handleKeyDown(e, s.action)}
                                  onBlur={() => setEditingAction(null)}
                                  style={{
                                    padding: '5px 8px',
                                    width: '150px',
                                    border: '2px solid var(--primary)',
                                    borderRadius: '4px',
                                    outline: 'none',
                                    fontSize: '12px',
                                    backgroundColor: '#eff6ff'
                                  }}
                                />
                                <button
                                  onMouseDown={(e) => { e.preventDefault(); setEditingAction(null); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '2px' }}
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              renderCommandBadges(s.command)
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#374151' }}>{s.description}</td>
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            {editingAction === s.action ? (
                              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Recording</span>
                            ) : (
                              <button 
                                onClick={() => setEditingAction(s.action)}
                                style={{
                                  background: '#f3f4f6',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                }}
                                title="Edit shortcut"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            
            {activeTab === 'General' && (
              <div>
                {query && !generalMatches ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div>No general settings matching &ldquo;{searchQuery}&rdquo;</div>
                    {filteredShortcuts.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={() => setActiveTab('Keyboard Shortcuts')}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, textDecoration: 'underline' }}
                        >
                          {filteredShortcuts.length} matching shortcut{filteredShortcuts.length > 1 ? 's' : ''} found in Keyboard Shortcuts &rarr;
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                      Forensic Watermark
                    </label>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Add a persistent, diagonal text watermark that overlays all document pages.
                    </div>
                    <input 
                      type="text" 
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Leave blank to disable watermark"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {watermarkText && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', color: '#16a34a', fontSize: '12.5px' }}>
                        <Check size={14} /> Watermark active: &ldquo;{watermarkText}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
