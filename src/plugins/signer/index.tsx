import React, { useState, useEffect } from 'react';
import { Pen } from 'lucide-react';
import type { ViewerPlugin, PluginContext, DigitalSignerOptions } from '../types';
import SignTypeModal from '../../components/SignTypeModal';

export function DigitalSignerPlugin(options?: DigitalSignerOptions): ViewerPlugin {
  return {
    id: 'digital-signer',
    name: 'Digital Signer & Hardware Token Plugin',
    
    renderHeaderActions: (context: PluginContext) => {
      if (context.permissions?.canSign === false) return null;

      return (
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('action-open-signtype-modal'))}
          style={{ 
            background: '#fff0f0', border: '1px solid #d32f2f', color: '#d32f2f', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            height: '32px', padding: '0 12px', borderRadius: '4px', cursor: 'pointer',
            fontWeight: 600, fontSize: '13px'
          }}
          title="Digital Signature & Hardware Token"
        >
          <Pen size={14} color="#d32f2f" fill="#d32f2f" />
          Sign
        </button>
      );
    },

    renderModals: (_context: PluginContext) => {
      return <SignerModalContainer options={options} />;
    }
  };
}

function SignerModalContainer({ options }: { options?: DigitalSignerOptions }) {
  const [isSignTypeModalOpen, setIsSignTypeModalOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsSignTypeModalOpen(true);
    window.addEventListener('action-open-signtype-modal', handleOpen);
    return () => window.removeEventListener('action-open-signtype-modal', handleOpen);
  }, []);

  if (!isSignTypeModalOpen) return null;

  return (
    <SignTypeModal 
      fileName="Document.pdf"
      userEmail="user@example.com"
      allowedSignTypes={options?.allowedTypes}
      onClose={() => setIsSignTypeModalOpen(false)}
      onSignNow={(signType) => {
        setIsSignTypeModalOpen(false);
        window.dispatchEvent(new CustomEvent('action-start-signature', { detail: { type: signType } }));
      }}
    />
  );
}
