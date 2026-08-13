/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { X, Info } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
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
        width: '500px',
        maxWidth: '90%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', borderBottom: '1px solid #e5e7eb', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={20} color="#2b76b9" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>About</h2>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#1f2937' }}>TeamSync PDF Viewer</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Version 1.0.0</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#4b5563' }}>© 2026 AngelBot Ai Pvt Ltd. All rights reserved.</p>
            <a href="https://www.teamsync.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', margin: '8px 0 0 0', fontSize: '14px', color: '#2b76b9', textDecoration: 'none', fontWeight: 500 }}>www.teamsync.com</a>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#4b5563', fontStyle: 'italic' }}>
              Licensed under the Common Public Attribution License Version 1.0 (CPAL).
            </p>
          </div>
          
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '16px' }}>Open Source Licenses & Credits</h3>
          <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, marginBottom: '16px' }}>
            This software is made possible by open source software and other third-party libraries that are distributed under their respective licenses:
          </p>

          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>pdfjs-dist</strong>: Licensed under the Apache License 2.0. Copyright Mozilla Foundation.</li>
            <li><strong>pdf-lib</strong>: Licensed under the MIT License. Copyright Andrew Dillon.</li>
            <li><strong>react</strong> / <strong>react-dom</strong>: Licensed under the MIT License. Copyright Meta Platforms, Inc.</li>
            <li><strong>lucide-react</strong>: Licensed under the ISC License. Copyright Lucide Contributors.</li>
            <li><strong>node-forge</strong>: Licensed under the BSD-3-Clause License or GPL. Copyright Digital Bazaar, Inc.</li>
            <li><strong>vite</strong>: Licensed under the MIT License. Copyright Evan You and Vite contributors.</li>
          </ul>

          <div style={{ marginTop: '16px', fontSize: '13px', textAlign: 'center' }}>
            <a href="/ThirdPartyNotices.txt" target="_blank" rel="noopener noreferrer" style={{ color: '#2b76b9', textDecoration: 'none', fontWeight: 500 }}>
              View Full License Notices
            </a>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ padding: '16px 24px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ 
              backgroundColor: '#2b76b9', color: '#fff', border: 'none', borderRadius: '4px',
              padding: '8px 24px', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
