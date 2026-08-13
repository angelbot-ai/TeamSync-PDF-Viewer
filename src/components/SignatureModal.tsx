/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SignatureModalProps {
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
}

export function SignatureModal({ onClose, onSave }: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<'Draw' | 'Type' | 'Upload'>('Draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [signatureColor, setSignatureColor] = useState('#000000');
  const [signatureFont, setSignatureFont] = useState('"Dancing Script", cursive');
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);

  useEffect(() => {
    // Clear canvas when tab changes
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        
        if (activeTab === 'Type' && typedText) {
          renderTypedText(ctx, canvas.width, canvas.height, typedText, signatureColor, signatureFont);
        } else if (activeTab === 'Upload' && uploadedImage) {
          renderUploadedImage(ctx, canvas.width, canvas.height, uploadedImage);
        }
      }
    }
  }, [activeTab, typedText, uploadedImage, signatureColor, signatureFont]);

  const renderTypedText = (ctx: CanvasRenderingContext2D, width: number, height: number, text: string, color: string, font: string) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.font = `48px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 - 20);
    setHasDrawn(true);
  };

  const renderUploadedImage = (ctx: CanvasRenderingContext2D, width: number, height: number, src: string) => {
    ctx.clearRect(0, 0, width, height);
    const img = new Image();
    img.onload = () => {
      // Scale to fit
      const scale = Math.min(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      setHasDrawn(true); // Ensure create is enabled and validation passes
    };
    img.src = src;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'Draw') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTab !== 'Draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    ctx.lineTo(x, y);
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setTypedText('');
        setUploadedImage(null);
        setHasDrawn(false);
      }
    }
  };

  const isCreateEnabled = hasDrawn || uploadedImage !== null || typedText.length > 0;

  const handleCreate = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Check if canvas is empty
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      if (canvas.toDataURL() === blank.toDataURL()) {
        alert('Please provide a signature.');
        return;
      }
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '500px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#333' }}>Create New Signature</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs - Segmented Control Style */}
        <div style={{ padding: '16px 24px 0 24px' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
            {['Draw', 'Type', 'Upload'].map((tab, idx) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  flex: 1, padding: '10px', background: activeTab === tab ? '#2b76b9' : '#fff', 
                  border: 'none', borderRight: idx < 2 ? '1px solid var(--border-color)' : 'none',
                  color: activeTab === tab ? '#fff' : '#333', fontSize: '14px', cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
          
          <div style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {activeTab === 'Type' && (
              <input 
                autoFocus
                type="text" 
                placeholder="Type your signature here..." 
                value={typedText}
                onChange={e => setTypedText(e.target.value)}
                style={{ 
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  padding: '16px', fontSize: '24px', border: 'none', outline: 'none', 
                  background: 'transparent', zIndex: 10,
                  color: typedText ? 'transparent' : '#9ca3af',
                  caretColor: '#333'
                }}
              />
            )}

            {activeTab === 'Upload' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: uploadedImage ? 'none' : 'auto' }}>
                {!uploadedImage && (
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ padding: '12px' }}
                  />
                )}
              </div>
            )}

            <canvas 
              ref={canvasRef}
              width={500}
              height={200}
              style={{ cursor: activeTab === 'Draw' ? 'crosshair' : 'default', touchAction: 'none', width: '100%', height: '200px' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            <div style={{ padding: '0 16px 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
              <div style={{ width: '100%', borderTop: '1px solid #ccc', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  {activeTab === 'Draw' ? 'Draw Signature*' : activeTab === 'Type' ? 'Type Signature*' : 'Upload Signature*'}
                </span>
                <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#2b76b9', cursor: 'pointer', fontSize: '14px', pointerEvents: 'auto', padding: 0 }}>Clear</button>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            {activeTab === 'Type' && (
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setIsFontMenuOpen(!isFontMenuOpen)}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 12px', background: '#fff', fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: signatureFont }}
                >
                  Text Styles <span style={{ fontSize: '10px' }}>▼</span>
                </div>
              {isFontMenuOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '150px', zIndex: 100 }}>
                  {[
                    { label: 'Dancing Script', value: '"Dancing Script", cursive' },
                    { label: 'Serif', value: 'serif' },
                    { label: 'Sans-Serif', value: 'sans-serif' },
                    { label: 'Monospace', value: 'monospace' }
                  ].map(f => (
                    <div 
                      key={f.value}
                      onClick={() => { setSignatureFont(f.value); setIsFontMenuOpen(false); }}
                      style={{ padding: '8px 12px', fontFamily: f.value, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    >
                      {f.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
            
            {activeTab === 'Type' && <div style={{ color: 'var(--border-color)' }}>|</div>}

            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { hex: '#000000', label: 'Black' },
                { hex: '#2b76b9', label: 'Blue' },
                { hex: '#d32f2f', label: 'Red' }
              ].map(c => (
                <div 
                  key={c.hex} 
                  onClick={() => setSignatureColor(c.hex)}
                  style={{ 
                    width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c.hex, 
                    cursor: 'pointer', border: signatureColor === c.hex ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: signatureColor === c.hex ? '0 0 0 2px #2b76b9' : 'none'
                  }} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fff' }}>
          <button 
            disabled={!isCreateEnabled}
            onClick={handleCreate} 
            style={{ 
              padding: '10px 24px', borderRadius: '4px', border: 'none', 
              background: isCreateEnabled ? '#2b76b9' : '#8fb6d7', 
              color: '#fff', cursor: isCreateEnabled ? 'pointer' : 'default', fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}
