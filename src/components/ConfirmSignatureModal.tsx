/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';

interface ConfirmSignatureModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSignatureModal({ onConfirm, onCancel }: ConfirmSignatureModalProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#fff',
        color: '#374151',
        borderRadius: '8px',
        width: '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>Confirm Signature</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>
            Are you sure you want to place this signature on the document? 
            Once confirmed, the signature will be applied. You will have 10 minutes to undo this action.
          </p>
        </div>
        <div style={{ 
          padding: '16px 24px', backgroundColor: '#f9fafb', 
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button 
            onClick={onCancel}
            style={{ 
              background: 'none', border: '1px solid #d1d5db', borderRadius: '4px', color: '#374151', 
              fontSize: '14px', fontWeight: 500, cursor: 'pointer', padding: '6px 16px',
              backgroundColor: '#fff'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            style={{ 
              backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px',
              padding: '6px 20px', fontSize: '14px', fontWeight: 500, cursor: 'pointer'
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
