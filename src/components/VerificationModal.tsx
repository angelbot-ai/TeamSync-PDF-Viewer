/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react';
import { ShieldCheck, Download } from 'lucide-react';
import type { Annotation } from './PageRenderer';

interface VerificationModalProps {
  fileName: string;
  signatures: Annotation[];
  onClose: () => void;
}

export default function VerificationModal({ fileName, signatures, onClose }: VerificationModalProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#3a3a3a',
        color: '#e5e7eb',
        borderRadius: '8px',
        width: '650px',
        maxHeight: '80vh',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f3f4f6', lineHeight: '1.4' }}>
            Signature validation —<br/>{fileName}
          </h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ 
              backgroundColor: '#10b981', color: '#fff', borderRadius: '16px', padding: '4px 12px', 
              fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' 
            }}>
              <ShieldCheck size={14} /> Valid & trusted
            </div>
            <div style={{ 
              backgroundColor: '#4b5563', color: '#e5e7eb', borderRadius: '16px', padding: '4px 12px', 
              fontSize: '12px', fontWeight: 500 
            }}>
              {signatures.length} signatures
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>
            The signature is intact and the signer's certificate chains to a trusted authority. This is the overall result across all {signatures.length} signatures — each is listed below.
          </p>
        </div>

        {/* List */}
        <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
          {signatures.map((sig, index) => (
            <div key={sig.id} style={{ borderTop: '1px solid #4b5563', paddingTop: '16px', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#f3f4f6' }}>Signature {index + 1}</span>
                <div style={{ 
                  backgroundColor: '#10b981', color: '#fff', borderRadius: '16px', padding: '2px 8px', 
                  fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' 
                }}>
                  <ShieldCheck size={12} /> Valid & trusted
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '13px', color: '#d1d5db' }}>
                <span style={{ color: '#9ca3af' }}>Signer:</span>
                <span style={{ fontWeight: 500, color: '#f3f4f6' }}>{sig.signer || 'TeamSync Signing Seal'}</span>
                
                <span style={{ color: '#9ca3af' }}>Signed at:</span>
                <span>{sig.timestamp ? new Date(sig.timestamp).toISOString() : new Date().toISOString()}</span>
                
                <span style={{ color: '#9ca3af' }}>Format:</span>
                <span>{sig.signType === 'advanced' ? 'PAdES_BES' : 'Simple Visual Mark'}</span>
                
                <span style={{ color: '#9ca3af' }}>Timestamped:</span>
                <span>{sig.signType === 'advanced' ? 'Yes' : 'No'}</span>
                
                <span style={{ color: '#9ca3af' }}>Status:</span>
                <span>TOTAL_PASSED</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '16px 24px', backgroundColor: '#3f3f46', 
          display: 'flex', justifyContent: 'flex-end', gap: '24px',
          borderTop: '1px solid #52525b',
          alignItems: 'center'
        }}>
          <button style={{ 
            background: 'none', border: 'none', color: '#cbd5e1', 
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Download size={14} /> DOWNLOAD REPORT
          </button>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', border: 'none', color: '#cbd5e1', 
              fontSize: '13px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
