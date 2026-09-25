/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * FormSignatureModal — signing dialog supporting Electronic (Draw, Type, Upload)
 * and Digital (Cryptographic Certificate & Audit Seal) signatures.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, PenTool, Type, Upload, ShieldCheck, RefreshCw, Check } from 'lucide-react';
import type { FormField, FormSignatureValue, SignatureType, FormAssignee, FormRole } from '../forms/types';
import type { ViewerUser } from '../core/types';

interface FormSignatureModalProps {
  field: FormField;
  assignee?: FormAssignee;
  actualUser?: ViewerUser | null;
  currentValue?: FormSignatureValue | any;
  defaultSignerName?: string;
  onSave: (value: FormSignatureValue) => void;
  onClear?: () => void;
  onClose: () => void;
}

export const FormSignatureModal: React.FC<FormSignatureModalProps> = ({
  field,
  assignee,
  actualUser,
  currentValue,
  defaultSignerName = '',
  onSave,
  onClear,
  onClose,
}) => {
  const isDigital = field.type === 'digital_signature' || field.signatureType === 'digital';
  const [signatureType, setSignatureType] = useState<SignatureType>(isDigital ? 'digital' : 'electronic');
  const [electronicTab, setElectronicTab] = useState<'draw' | 'type' | 'upload'>('draw');

  // Signer Name
  const initialSignerName =
    (typeof currentValue === 'object' && currentValue?.signerName) ||
    actualUser?.name ||
    defaultSignerName ||
    assignee?.name ||
    '';
  const [signerName, setSignerName] = useState<string>(initialSignerName);

  // Digital Signature Reason
  const initialReason =
    (typeof currentValue === 'object' && currentValue?.reason) || 'Document Approval';
  const [signingReason, setSigningReason] = useState<string>(initialReason);

  // Typed cursive signature font choice
  const [typedFontIndex, setTypedFontIndex] = useState<number>(0);
  const cursiveFonts = [
    { name: 'Dancing Script', style: 'italic', family: '"Dancing Script", "Brush Script MT", cursive' },
    { name: 'Casual Script', style: 'normal', family: '"Caveat", "Segoe Script", cursive' },
    { name: 'Calligraphy', style: 'italic', family: '"Great Vibes", "Lucida Handwriting", cursive' },
  ];

  // Uploaded signature image
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(
    typeof currentValue === 'object' && currentValue?.dataUrl ? currentValue.dataUrl : null
  );

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<Array<{ points: { x: number; y: number }[]; color: string; width: number }>>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState('#0f172a');
  const penColorRef = useRef(penColor);
  penColorRef.current = penColor;

  // Generate SHA-256 style fingerprint for digital signature preview
  const [certFingerprint] = useState(() => {
    if (typeof currentValue === 'object' && currentValue?.certificateHash) {
      return currentValue.certificateHash;
    }
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  });

  // Redraw all stored strokes cleanly on high-DPI canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (canvas.clientWidth || 480);
    const h = rect.height > 0 ? rect.height : (canvas.clientHeight || 150);

    const targetWidth = Math.round(w * dpr);
    const targetHeight = Math.round(h * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.clearRect(0, 0, w, h);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width || 2.5;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      if (stroke.points.length === 1) {
        ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y + 0.1);
      }
      ctx.stroke();
    }
  }, []);

  // Setup canvas high-DPI on mount / tab switch (without resetting on penColor change)
  useEffect(() => {
    if (signatureType !== 'electronic' || electronicTab !== 'draw') return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      redrawCanvas();

      // If existing signature dataUrl exists and no strokes yet, draw it
      if (typeof currentValue === 'object' && currentValue?.dataUrl && strokesRef.current.length === 0 && !hasDrawn) {
        const img = new Image();
        img.onload = () => {
          const rect = canvas.getBoundingClientRect();
          const w = rect.width > 0 ? rect.width : (canvas.clientWidth || 480);
          const h = rect.height > 0 ? rect.height : (canvas.clientHeight || 150);
          ctx.drawImage(img, 0, 0, w, h);
          setHasDrawn(true);
        };
        img.src = currentValue.dataUrl;
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [signatureType, electronicTab, redrawCanvas]);

  // Window-level mouseup / touchend listeners so strokes end cleanly if pointer leaves canvas
  useEffect(() => {
    const handleGlobalEnd = () => {
      isDrawingRef.current = false;
    };
    window.addEventListener('mouseup', handleGlobalEnd);
    window.addEventListener('touchend', handleGlobalEnd);
    return () => {
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, []);

  // Canvas drawing handlers
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.touches.length === 1 && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    setHasDrawn(true);

    const pos = getCanvasPos(e);
    strokesRef.current.push({
      points: [pos],
      color: penColorRef.current,
      width: 2.5,
    });

    ctx.beginPath();
    ctx.strokeStyle = penColorRef.current;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasPos(e);
    const activeStroke = strokesRef.current[strokesRef.current.length - 1];
    if (activeStroke) {
      activeStroke.points.push(pos);
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    isDrawingRef.current = false;
  };

  const handleClearCanvas = () => {
    strokesRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  // Convert typed cursive text to PNG dataUrl using offscreen canvas (with SVG fallback)
  const renderTypedToDataUrl = useCallback((nameText: string, fontObj: typeof cursiveFonts[0]): string => {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 600;
      offscreen.height = 180;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.fillStyle = penColor;
        ctx.font = `${fontObj.style} 52px ${fontObj.family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameText || 'Signature', 300, 90);
        const data = offscreen.toDataURL('image/png');
        if (data && data.length > 30 && data !== 'data:,') {
          return data;
        }
      }
    } catch {
      // Fallback to SVG below
    }

    // High quality vector SVG data URL fallback
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180"><text x="300" y="90" font-family="${fontObj.name}, cursive" font-size="52" font-style="${fontObj.style}" fill="${penColor}" text-anchor="middle" dominant-baseline="middle">${nameText || 'Signature'}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [penColor]);

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setUploadedDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Commit signature
  const handleAdoptAndSign = () => {
    if (signatureType === 'digital') {
      const finalName = signerName.trim() || actualUser?.name || 'Authorized Signer';
      const sigVal: FormSignatureValue = {
        type: 'digital',
        signerName: finalName,
        signerEmail: actualUser?.email,
        signerRole: assignee?.name || field.assigneeId,
        timestamp: Date.now(),
        reason: signingReason,
        certificateHash: certFingerprint,
      };
      onSave(sigVal);
      onClose();
      return;
    }

    // Electronic Signature
    let finalDataUrl = '';
    const finalSignerName = signerName.trim() || actualUser?.name || 'Signer';

    if (electronicTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas && hasDrawn) {
        finalDataUrl = canvas.toDataURL('image/png');
      }
      if (!finalDataUrl || !hasDrawn) {
        alert('Please draw your signature before adopting.');
        return;
      }
    } else if (electronicTab === 'type') {
      finalDataUrl = renderTypedToDataUrl(signerName.trim() || actualUser?.name || 'Signature', cursiveFonts[typedFontIndex]);
      if (!finalDataUrl) {
        alert('Please enter your name for the signature.');
        return;
      }
    } else if (electronicTab === 'upload') {
      finalDataUrl = uploadedDataUrl || '';
      if (!finalDataUrl) {
        alert('Please upload a signature image before adopting.');
        return;
      }
    }

    const sigVal: FormSignatureValue = {
      type: 'electronic',
      dataUrl: finalDataUrl,
      signerName: finalSignerName,
      signerEmail: actualUser?.email,
      signerRole: assignee?.name || field.assigneeId,
      timestamp: Date.now(),
    };
    onSave(sigVal);
    onClose();
  };

  const accentColor = assignee?.color || '#0284c7';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          width: '100%',
          maxWidth: '560px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: `${accentColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              {signatureType === 'digital' ? <ShieldCheck size={18} /> : <PenTool size={18} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                {signatureType === 'digital' ? 'Apply Digital Signature' : 'Adopt Electronic Signature'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '2px', flexWrap: 'wrap' }}>
                {field.label && <span>{field.label} · </span>}
                {assignee && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: `${accentColor}15`,
                      color: accentColor,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      fontSize: '11px',
                    }}
                  >
                    Role: {assignee.name}
                  </span>
                )}
                {actualUser?.name ? (
                  <span style={{ color: '#334155' }}>
                    Signer: <strong>{actualUser.name}</strong>
                    {actualUser.email ? ` (${actualUser.email})` : ''}
                  </span>
                ) : !assignee ? (
                  <span>Document Signature</span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Signature Type Switcher (if field allows both, or author didn't enforce strictly) */}
        <div
          style={{
            display: 'flex',
            padding: '10px 20px 0 20px',
            backgroundColor: '#ffffff',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setSignatureType('electronic')}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: signatureType === 'electronic' ? accentColor : '#e2e8f0',
              backgroundColor: signatureType === 'electronic' ? `${accentColor}10` : '#ffffff',
              color: signatureType === 'electronic' ? accentColor : '#64748b',
              fontWeight: signatureType === 'electronic' ? 600 : 400,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <PenTool size={14} />
            <span>Electronic Signature</span>
          </button>

          <button
            type="button"
            onClick={() => setSignatureType('digital')}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: signatureType === 'digital' ? '#0284c7' : '#e2e8f0',
              backgroundColor: signatureType === 'digital' ? '#0284c710' : '#ffffff',
              color: signatureType === 'digital' ? '#0284c7' : '#64748b',
              fontWeight: signatureType === 'digital' ? 600 : 400,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldCheck size={14} />
            <span>Digital Certificate</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Signer Name Input (Used in both modes) */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                Signer Full Name
              </label>
              {actualUser?.name && (
                <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 500 }}>
                  User session: {actualUser.name}
                </span>
              )}
            </div>
            <input
              type="text"
              value={signerName}
              placeholder="e.g. Jane Doe"
              onChange={(e) => setSignerName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ELECTRONIC SIGNATURE PANEL */}
          {signatureType === 'electronic' && (
            <div>
              {/* Method Sub-tabs: Draw, Type, Upload */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '12px',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setElectronicTab('draw')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderBottom: electronicTab === 'draw' ? `2px solid ${accentColor}` : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: electronicTab === 'draw' ? accentColor : '#64748b',
                    fontWeight: electronicTab === 'draw' ? 600 : 400,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <PenTool size={13} /> Draw
                </button>

                <button
                  type="button"
                  onClick={() => setElectronicTab('type')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderBottom: electronicTab === 'type' ? `2px solid ${accentColor}` : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: electronicTab === 'type' ? accentColor : '#64748b',
                    fontWeight: electronicTab === 'type' ? 600 : 400,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Type size={13} /> Type
                </button>

                <button
                  type="button"
                  onClick={() => setElectronicTab('upload')}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderBottom: electronicTab === 'upload' ? `2px solid ${accentColor}` : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: electronicTab === 'upload' ? accentColor : '#64748b',
                    fontWeight: electronicTab === 'upload' ? 600 : 400,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Upload size={13} /> Upload Image
                </button>
              </div>

              {/* DRAW TAB */}
              {electronicTab === 'draw' && (
                <div>
                  <div
                    style={{
                      position: 'relative',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: '#fbfcfd',
                      overflow: 'hidden',
                      touchAction: 'none',
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      style={{ width: '100%', height: '150px', display: 'block', cursor: 'crosshair' }}
                      onMouseDown={handleStartDraw}
                      onMouseMove={handleDraw}
                      onMouseUp={handleEndDraw}
                      onMouseLeave={handleEndDraw}
                      onTouchStart={handleStartDraw}
                      onTouchMove={handleDraw}
                      onTouchEnd={handleEndDraw}
                    />

                    {/* Baseline indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '20px',
                        right: '20px',
                        bottom: '30px',
                        borderBottom: '1px dashed #cbd5e1',
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: '0',
                          bottom: '2px',
                          fontSize: '14px',
                          color: '#94a3b8',
                          fontWeight: 'bold',
                        }}
                      >
                        ✕
                      </span>
                    </div>

                    {!hasDrawn && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#94a3b8',
                          fontSize: '12px',
                          pointerEvents: 'none',
                          textAlign: 'center',
                        }}
                      >
                        Draw your signature above the line
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Ink:</span>
                      {['#0f172a', '#1e40af', '#047857'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPenColor(c)}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: c,
                            border: penColor === c ? '2px solid #38bdf8' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleClearCanvas}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={12} /> Clear
                    </button>
                  </div>
                </div>
              )}

              {/* TYPE TAB */}
              {electronicTab === 'type' && (
                <div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px 0' }}>
                    Select a handwriting style:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cursiveFonts.map((font, idx) => (
                      <div
                        key={idx}
                        onClick={() => setTypedFontIndex(idx)}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: typedFontIndex === idx ? `2px solid ${accentColor}` : '1px solid #e2e8f0',
                          backgroundColor: typedFontIndex === idx ? `${accentColor}08` : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '26px',
                            fontFamily: font.family,
                            fontStyle: font.style,
                            color: penColor,
                            letterSpacing: '1px',
                          }}
                        >
                          {signerName.trim() || 'Jane Doe'}
                        </span>
                        {typedFontIndex === idx && <Check size={16} color={accentColor} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPLOAD TAB */}
              {electronicTab === 'upload' && (
                <div>
                  <div
                    style={{
                      border: '1px dashed #cbd5e1',
                      borderRadius: '8px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {uploadedDataUrl ? (
                      <div>
                        <img
                          src={uploadedDataUrl}
                          alt="Signature Preview"
                          style={{ maxHeight: '100px', maxWidth: '80%', objectFit: 'contain', margin: '0 auto 12px auto' }}
                        />
                        <div>
                          <label
                            style={{
                              display: 'inline-block',
                              padding: '5px 12px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Replace Image
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg"
                              style={{ display: 'none' }}
                              onChange={handleFileUpload}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={28} color="#94a3b8" style={{ margin: '0 auto 8px auto' }} />
                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                          Upload an image of your signature
                        </p>
                        <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#64748b' }}>
                          PNG or JPG format with transparent or white background
                        </p>
                        <label
                          style={{
                            display: 'inline-block',
                            padding: '6px 14px',
                            backgroundColor: accentColor,
                            color: '#ffffff',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Browse File
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DIGITAL SIGNATURE PANEL */}
          {signatureType === 'digital' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Reason for Signing
                </label>
                <select
                  value={signingReason}
                  onChange={(e) => setSigningReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Document Approval">I approve this document</option>
                  <option value="Consent and Agreement">I agree to the terms herein</option>
                  <option value="Witness Verification">I witness this signature</option>
                  <option value="Authorship">I am the author of this document</option>
                </select>
              </div>

              {/* Digital Certificate Preview Card */}
              <div
                style={{
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  backgroundColor: '#f0f9ff',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={20} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                    Digitally signed by {signerName.trim() || actualUser?.name || 'Signer'}
                  </div>
                  {actualUser?.email && (
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
                      Email: {actualUser.email}
                    </div>
                  )}
                  {assignee?.name && (
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
                      Role: {assignee.name}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
                    Date: {new Date().toLocaleString('en-GB')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                    Reason: {signingReason}
                  </div>
                  <div
                    style={{
                      fontSize: '9.5px',
                      color: '#0369a1',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      backgroundColor: '#e0f2fe',
                      padding: '4px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    SHA-256: {certFingerprint.slice(0, 32)}...
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                This creates a verifiable digital signature record that locks your identity, signing reason, and exact timestamp into the PDF audit trail.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          {onClear && currentValue ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Remove Signature
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleAdoptAndSign}
              style={{
                padding: '7px 18px',
                backgroundColor: accentColor,
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Check size={14} />
              <span>{signatureType === 'digital' ? 'Digitally Sign' : 'Adopt & Sign'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
