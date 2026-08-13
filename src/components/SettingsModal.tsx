/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState } from 'react';
import { X, Edit2, Search } from 'lucide-react';
import { Vault } from '../utils/vault';
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
  
  
  const [_p12File, setP12File] = useState<File | null>(null);
  const [p12Password, setP12Password] = useState('');
  const [p12Status, setP12Status] = useState<string>('');
  const [signatureMethod, setSignatureMethod] = useState<'p12' | 'usb'>('p12');
  const [bridgeToken, setBridgeToken] = useState('');
  const [usbStatus, setUsbStatus] = useState<string>('');

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
            {['General', 'Keyboard Shortcuts', 'Digital Signatures'].map(tab => (
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
            
            {activeTab === 'Digital Signatures' && (
              <div style={{ padding: '0' }}>
                <h3 style={{ marginTop: 0 }}>Cryptographic Digital Signatures</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
                  Cryptographically sign your documents when you save or download them. This adds an invisible, secure PKI wrapper around the file to prevent unauthorized modifications.
                </p>

                <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="sigMethod" 
                      checked={signatureMethod === 'p12'} 
                      onChange={() => {
                        setSignatureMethod('p12');
                        sessionStorage.setItem('signature_method', 'p12');
                      }}
                    />
                    <span>Upload .p12 / .pfx Certificate</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="sigMethod" 
                      checked={signatureMethod === 'usb'} 
                      onChange={() => {
                        setSignatureMethod('usb');
                        sessionStorage.setItem('signature_method', 'usb');
                      }}
                    />
                    <span>Hardware Token (eMudhra / nCode)</span>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
                  {signatureMethod === 'p12' && (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Certificate File (.p12)</label>
                        <input 
                          type="file" 
                          accept=".p12,.pfx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const file = e.target.files[0];
                              setP12File(file);
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (reader.result) {
                                  const base64 = btoa(new Uint8Array(reader.result as ArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                                  Vault.setP12Cert(base64);
                                  setP12Status('Certificate securely loaded into memory vault.');
                                }
                              };
                              reader.readAsArrayBuffer(file);
                            }
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Certificate Password</label>
                        <input 
                          type="password" 
                          value={p12Password}
                          onChange={(e) => {
                            setP12Password(e.target.value);
                            Vault.setP12Password(e.target.value);
                          }}
                          placeholder="Enter certificate password..."
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                      </div>
                      
                      {p12Status && (
                        <div style={{ padding: '12px', backgroundColor: '#eef2ff', color: 'var(--primary)', borderRadius: '4px', fontSize: '13px' }}>
                          {p12Status}
                        </div>
                      )}
                    </>
                  )}

                  {signatureMethod === 'usb' && (
                    <div style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>USB Bridge Service Required</h4>
                      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Browsers cannot directly access Class 3 DSC Tokens. To sign using your eMudhra or nCode token, you must be running the Local Bridge Service on your computer.
                      </p>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Bridge Authorization Token</label>
                        <input 
                          type="password" 
                          value={bridgeToken}
                          onChange={(e) => {
                            setBridgeToken(e.target.value);
                            Vault.setBridgeToken(e.target.value);
                          }}
                          placeholder="Enter token from bridge console..."
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Required to securely authorize the connection and prevent CSWSH attacks.</p>
                      </div>
                      
                      <button 
                        onClick={async () => {
                          setUsbStatus('Connecting...');
                          try {
                            const ws = new WebSocket('ws://127.0.0.1:8080');
                            ws.onopen = () => {
                              setUsbStatus('Successfully connected to bridge service!');
                              ws.close();
                            };
                            ws.onerror = () => {
                              setUsbStatus('Failed to connect. Ensure the bridge service is running.');
                            };
                          } catch {
                            setUsbStatus('Failed to connect.');
                          }
                        }}
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#f9fafb', cursor: 'pointer', fontSize: '13px' }}
                      >
                        Test Connection
                      </button>
                      
                      {usbStatus && (
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: usbStatus.includes('Failed') ? '#fef2f2' : '#eef2ff', color: usbStatus.includes('Failed') ? '#b91c1c' : 'var(--primary)', borderRadius: '4px', fontSize: '13px' }}>
                          {usbStatus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
