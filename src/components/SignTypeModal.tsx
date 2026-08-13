/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { PenTool, FileText, ShieldCheck } from 'lucide-react';

interface SignTypeModalProps {
  fileName: string;
  userEmail: string;
  allowedSignTypes?: ('digital' | 'ades' | 'simple')[];
  onClose: () => void;
  onSignNow: (signType: 'digital' | 'ades' | 'simple') => void;
}

export default function SignTypeModal({ fileName, allowedSignTypes = ['digital', 'ades', 'simple'], onClose, onSignNow }: SignTypeModalProps) {
  const isAllowed = (type: 'digital' | 'ades' | 'simple') => !allowedSignTypes || allowedSignTypes.includes(type);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#3a3a3a',
        color: '#e5e7eb',
        borderRadius: '8px',
        width: '600px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        fontFamily: 'sans-serif',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #4b5563', 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PenTool size={20} color="#9ca3af" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500, color: '#f3f4f6' }}>Signature Type</h2>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
          >
            <ShieldCheck size={20} style={{ opacity: 0 }} /> {/* Spacer */}
            <span style={{ fontSize: '20px', lineHeight: 1 }}>&times;</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <FileText size={16} color="#9ca3af" />
            <span style={{ fontSize: '14px', color: '#d1d5db' }}>{fileName}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Digital Signature Button */}
            {isAllowed('digital') && (
              <button 
                onClick={() => onSignNow('digital')}
                style={{ 
                  padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
                  backgroundColor: '#3a3a3a', border: '1px solid #4b5563', borderRadius: '8px', 
                  color: '#f3f4f6', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
              >
                <div style={{ fontWeight: 600, fontSize: '14px' }}>DIGITAL SIGNATURE</div>
                <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.4' }}>
                  Full cryptographic signature using hardware tokens (eMudhra/nCode) or software certificates, ensuring absolute non-repudiation.
                </div>
              </button>
            )}

            {/* ADeS Signature Button */}
            {isAllowed('ades') && (
              <button 
                onClick={() => onSignNow('ades')}
                style={{ 
                  padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
                  backgroundColor: '#3a3a3a', border: '1px solid #60a5fa', borderRadius: '8px', 
                  color: '#f3f4f6', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#60a5fa" />
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>ADeS SIGNATURE</div>
                  <span style={{ 
                    backgroundColor: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', fontSize: '10px', 
                    padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold'
                  }}>RECOMMENDED</span>
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.4' }}>
                  Each signature is bound to a certificate and a trusted timestamp, and the document is sealed so any later change is detectable.
                </div>
              </button>
            )}

            {/* Simple Signature Button */}
            {isAllowed('simple') && (
              <button 
                onClick={() => onSignNow('simple')}
                style={{ 
                  padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
                  backgroundColor: '#3a3a3a', border: '1px solid #4b5563', borderRadius: '8px', 
                  color: '#f3f4f6', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#4b5563'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#3a3a3a'}
              >
                <div style={{ fontWeight: 600, fontSize: '14px' }}>SIMPLE SIGNATURE</div>
                <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.4' }}>
                  Standard visual signature mark without cryptographic sealing.
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
