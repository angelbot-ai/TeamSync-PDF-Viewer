/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface InsertLinkModalProps {
  initialUrl?: string;
  initialText?: string;
  showTextInput?: boolean;
  onClose: () => void;
  onSave: (url: string, text?: string) => void;
}

export default function InsertLinkModal({ initialUrl = '', initialText = '', showTextInput = false, onClose, onSave }: InsertLinkModalProps) {
  const isInitialPage = initialUrl.startsWith('#page=');
  const [activeTab, setActiveTab] = useState<'url' | 'page'>(isInitialPage ? 'page' : 'url');
  const [url, setUrl] = useState(isInitialPage ? '' : initialUrl);
  const [page, setPage] = useState(isInitialPage ? initialUrl.replace('#page=', '') : '1');
  const [text, setText] = useState(initialText);

  const isSaveDisabled = activeTab === 'url' ? !url.trim() : !page.trim();

  const handleSave = () => {
    if (isSaveDisabled) return;
    const finalUrl = activeTab === 'page' ? `#page=${page}` : url;
    if (showTextInput) {
      onSave(finalUrl, text.trim() || finalUrl);
    } else {
      onSave(finalUrl);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000
    }}>
      <div style={{
        backgroundColor: '#fff',
        color: '#333',
        borderRadius: '8px',
        width: '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px', borderBottom: '1px solid #e5e7eb', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Insert Link or Page</h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', border: '1px solid #2b76b9', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
            <div 
              onClick={() => setActiveTab('url')}
              style={{ flex: 1, textAlign: 'center', padding: '8px', backgroundColor: activeTab === 'url' ? '#2b76b9' : '#fff', color: activeTab === 'url' ? '#fff' : '#6b7280', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              URL
            </div>
            <div 
              onClick={() => setActiveTab('page')}
              style={{ flex: 1, textAlign: 'center', padding: '8px', backgroundColor: activeTab === 'page' ? '#2b76b9' : '#fff', color: activeTab === 'page' ? '#fff' : '#6b7280', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              Page
            </div>
          </div>

          {/* URL or Page input (mandatory) */}
          {activeTab === 'url' ? (
            <div style={{ marginBottom: showTextInput ? '16px' : '0' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Enter URL <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%', padding: '10px', boxSizing: 'border-box',
                  border: `1px solid ${!url.trim() ? '#fca5a5' : '#d1d5db'}`, borderRadius: '4px', fontSize: '14px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                autoFocus
              />
            </div>
          ) : (
            <div style={{ marginBottom: showTextInput ? '16px' : '0' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Enter Page Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="number" 
                value={page}
                min="1"
                onChange={(e) => setPage(e.target.value)}
                placeholder="10"
                style={{
                  width: '100%', padding: '10px', boxSizing: 'border-box',
                  border: `1px solid ${!page.trim() ? '#fca5a5' : '#d1d5db'}`, borderRadius: '4px', fontSize: '14px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                autoFocus
              />
            </div>
          )}

          {/* Text to Display (optional, below URL/Page) */}
          {showTextInput && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Text to Display <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '12px' }}>(optional — defaults to URL/page)</span>
              </label>
              <input 
                type="text" 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={activeTab === 'url' ? url || 'Link text...' : `Page ${page}`}
                style={{
                  width: '100%', padding: '10px', boxSizing: 'border-box',
                  border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f9fafb' }}>
          <button 
            onClick={handleSave}
            disabled={isSaveDisabled}
            style={{ 
              backgroundColor: isSaveDisabled ? '#93c5fd' : '#2b76b9', color: '#fff', border: 'none', borderRadius: '4px',
              padding: '8px 24px', fontSize: '14px', fontWeight: 500, cursor: isSaveDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            Link
          </button>
        </div>
      </div>
    </div>
  );
}
