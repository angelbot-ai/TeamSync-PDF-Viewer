/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { type SearchResult } from '../hooks/usePdfSearch';
import type { Redaction, WatermarkOptions } from '../core/types';
import type { Annotation } from '../annotations/types';
import { getRotationTransform, convertToRotatedRect, normalizeRotation } from '../utils/rotationUtils';

export type { Annotation };

interface PageRendererProps {
  pageNum: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  scale: number;
  rotation: number;
  containerWidth: number;
  containerHeight: number;
  scrollTop: number;
  scrollLeft: number;
  pageTop: number;
  pageLeft?: number;
  basePageWidth: number;
  basePageHeight: number;
  
  // App state
  activeTab: string;
  activeTool: string | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  activeSearchResult: SearchResult | null;

  // Handlers
  onMouseDown: (e: React.MouseEvent<Element>, pageNum: number) => void;
  onMouseMove: (e: React.MouseEvent<Element>, pageNum: number) => void;
  onMouseUp: (e: React.MouseEvent<Element>, pageNum: number) => void;
  onAnnotationClick: (id: string, e: React.MouseEvent) => void;
  onAnnotationMouseEnter: (id: string) => void;
  onClearSelection: () => void;
  watermark?: WatermarkOptions;
  watermarkText?: string;
  redactions?: Redaction[];
  onDiscardRedaction?: (redaction: Redaction) => void;
  /** Called after the page canvas has been painted (used for first-page-rendered telemetry). */
  onRendered?: (pageNum: number) => void;
}

function PageRendererComponent({
  pageNum, pdfDoc, scale, rotation, containerWidth: _containerWidth, containerHeight: _containerHeight,
  scrollTop: _scrollTop, scrollLeft: _scrollLeft, pageTop, pageLeft = 0, basePageWidth, basePageHeight,
  activeTab, activeTool, annotations, selectedAnnotationId, activeSearchResult,
  onMouseDown, onMouseMove, onMouseUp, onAnnotationClick, onAnnotationMouseEnter, onClearSelection,
  watermark, watermarkText, redactions, onDiscardRedaction, onRendered
}: PageRendererProps) {
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const pageProxyRef = useRef<pdfjsLib.PDFPageProxy | null>(null);
  const [textContent, setTextContent] = useState<any>(null);

  const scaledWidth = basePageWidth * scale;
  const scaledHeight = basePageHeight * scale;

  // Intersection logic for canvas rendering (tile rendering to save memory)
  useEffect(() => {
    let isCancelled = false;
    let timer: any = null;

    const renderCanvas = async () => {
      if (!canvasRef.current || !pdfDoc) return;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        let outputScale = window.devicePixelRatio || 1;
        // Compose UI rotation with the page's intrinsic /Rotate (pdf.js replaces it otherwise).
        const viewport = page.getViewport({ scale: scale * outputScale, rotation: normalizeRotation(page.rotate + rotation) });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.floor(viewport.width);
        tempCanvas.height = Math.floor(viewport.height);
        const ctx = tempCanvas.getContext('2d');
        if (!ctx || isCancelled) return;

        renderTaskRef.current = page.render({
          canvasContext: ctx,
          canvas: tempCanvas,
          viewport: viewport
        });
        await renderTaskRef.current.promise;
        
        // --- Pixel Masking (Redactions) ---
        if (redactions && redactions.length > 0) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const unW = rotation % 180 === 0 ? basePageWidth : basePageHeight;
          const unH = rotation % 180 === 0 ? basePageHeight : basePageWidth;
          
          for (const redaction of redactions) {
            if (redaction.pageIndex === pageNum) {
              const rotRect = convertToRotatedRect(redaction.x, redaction.y, redaction.width, redaction.height, rotation, unW, unH);
              const vX = rotRect.x * scale * outputScale;
              const vY = rotRect.y * scale * outputScale;
              const vW = rotRect.width * scale * outputScale;
              const vH = rotRect.height * scale * outputScale;
              
              if (redaction.status === 'applied' || redaction.status === undefined) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(Math.floor(vX), Math.floor(vY), Math.ceil(vW), Math.ceil(vH));
              } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(Math.floor(vX), Math.floor(vY), Math.ceil(vW), Math.ceil(vH));
                ctx.lineWidth = 2 * outputScale;
                ctx.strokeStyle = '#dc2626';
                ctx.strokeRect(Math.floor(vX), Math.floor(vY), Math.ceil(vW), Math.ceil(vH));
              }
            }
          }
          ctx.restore();
        }

        // --- Forensic Watermark Rendering ---
        const wm = watermark || (watermarkText ? { text: watermarkText, opacity: 0.15, size: 24, mode: 'tiled', color: '#000000' } : undefined);
        if (wm && wm.text) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          const opacity = wm.opacity ?? 0.15;
          const mode = wm.mode ?? 'tiled';
          const defaultSize = mode === 'single' ? 48 : 18;
          const size = (wm.size ?? defaultSize) * scale * outputScale;
          const text = wm.text;
          
          ctx.fillStyle = wm.color ?? '#000000';
          ctx.globalAlpha = opacity;
          ctx.font = `600 ${size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const canvasW = tempCanvas.width;
          const canvasH = tempCanvas.height;
          
          if (mode === 'single') {
            ctx.translate(canvasW / 2, canvasH / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(text, 0, 0);
          } else {
            const stepX = size * text.length * 0.8 + 100 * scale * outputScale;
            const stepY = 180 * scale * outputScale;
            const diag = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
            
            ctx.translate(canvasW / 2, canvasH / 2);
            ctx.rotate(-Math.PI / 4);
            
            for (let y = -diag; y < diag; y += stepY) {
              const rowOffset = (Math.abs(y / stepY) % 2) * (stepX / 2);
              for (let x = -diag; x < diag; x += stepX) {
                ctx.fillText(text, x + rowOffset, y);
              }
            }
          }
          ctx.restore();
        }

        // Transfer rendered contents to displayed canvas element
        const destCanvas = canvasRef.current;
        if (destCanvas && !isCancelled) {
          destCanvas.width = tempCanvas.width;
          destCanvas.height = tempCanvas.height;
          const destCtx = destCanvas.getContext('2d');
          if (destCtx) {
            destCtx.drawImage(tempCanvas, 0, 0);
          }
          onRenderedRef.current?.(pageNum);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render failed:`, err);
        }
      }
    };

    // 60ms debounce allows live zoom gestures to scale smoothly at 60 FPS via GPU CSS
    // while PDF.js vector rendering fires once the zoom motion settles.
    timer = setTimeout(renderCanvas, 60);

    const currentRenderTask = renderTaskRef.current;
    const currentPageProxy = pageProxyRef.current;

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch {}
      }
      if (currentPageProxy) {
        try { currentPageProxy.cleanup(); } catch {}
      }
    };
  }, [pageNum, pdfDoc, scale, rotation, scaledWidth, scaledHeight, watermark, watermarkText, redactions]);

  // Load TextContent independently
  useEffect(() => {
    let isCancelled = false;
    const fetchText = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const text = await page.getTextContent();
        
        // --- Text Layer Sanitization (Anti-Copy/Paste) ---
        if (redactions && redactions.length > 0) {
          const pageRedactions = redactions.filter(r => r.pageIndex === pageNum);
          if (pageRedactions.length > 0) {
            // Filter out text items that intersect with redactions
            text.items = text.items.filter((item: any) => {
              if (item.str.trim() === '') return true; // Keep whitespace items for layout

              // item.transform: [scaleX, skewY, skewX, scaleY, tx, ty]
              // tx, ty are PDF coordinates (bottom-left origin)
              const itemX = item.transform[4];
              const itemY = item.transform[5];
              const itemW = item.width;
              const itemH = item.height; // Approximate height

              for (const red of pageRedactions) {
                // Check AABB intersection
                const intersectX = Math.max(itemX, red.x) < Math.min(itemX + itemW, red.x + red.width);
                const intersectY = Math.max(itemY, red.y) < Math.min(itemY + itemH, red.y + red.height);
                
                if (intersectX && intersectY) {
                  return false; // Intersects, permanently remove from DOM
                }
              }
              return true;
            });
          }
        }
        
        if (!isCancelled) setTextContent(text);
      } catch {}
    };
    fetchText();
    return () => { isCancelled = true; };
  }, [pdfDoc, pageNum, redactions]);

  // Render TextLayer
  useEffect(() => {
    const container = textLayerRef.current;
    if (!textContent || !container) return;
    const renderText = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1, rotation: normalizeRotation(page.rotate + rotation) });

        let sanitizedTextContent = textContent;
        if (redactions && redactions.length > 0) {
          const pageRedactions = redactions.filter(r => r.pageIndex === pageNum);
          if (pageRedactions.length > 0) {
            const filteredItems = textContent.items.filter((item: any) => {
              if (!item.str || item.str.trim() === '') return true;
              const itemX = item.transform[4];
              const itemY = item.transform[5];
              const itemW = item.width;
              const itemH = item.height || Math.abs(item.transform[3]);
              const itemTopY = viewport.height - itemY - itemH;

              for (const red of pageRedactions) {
                const intersectX = Math.max(itemX, red.x) < Math.min(itemX + itemW, red.x + red.width);
                const intersectY = Math.max(itemTopY, red.y) < Math.min(itemTopY + itemH, red.y + red.height);
                if (intersectX && intersectY) {
                  return false;
                }
              }
              return true;
            });
            sanitizedTextContent = { ...textContent, items: filteredItems };
          }
        }

        container.innerHTML = '';
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: sanitizedTextContent,
          container: container,
          viewport: viewport
        });
        await textLayer.render();
      } catch (e) {
        console.error("TextLayer render failed:", e);
      }
    };
    renderText();
  }, [textContent, pdfDoc, pageNum, rotation, redactions]);
  const pageAnnotations = annotations.filter(a => a.pageIndex === pageNum);

  return (
    <div 
      id={`pdf-page-${pageNum}`}
      className="pdf-page-container"
      onClick={() => { if (activeTool === null) onClearSelection(); }}
      style={{
        position: 'absolute',
        top: `${pageTop}px`,
        left: pageLeft !== undefined ? `${pageLeft}px` : '0px',
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        backgroundColor: '#fff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: '16px'
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 }} />
      
      <div 
        ref={textLayerRef}
        className="textLayer"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'auto',
          opacity: 1,
          width: `${basePageWidth}px`,
          height: `${basePageHeight}px`
        }}
      />

      {/* Custom Search Highlighting Layer */}
      {activeSearchResult && activeSearchResult.pageIndex === pageNum && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
          {activeSearchResult.bounds.map((b, idx) => (
            <div key={idx} style={{
              position: 'absolute',
              left: `${b.x * scale}px`,
              bottom: `${b.y * scale}px`,
              width: `${b.width * scale}px`,
              height: `${b.height * scale}px`,
              backgroundColor: 'rgba(255, 255, 0, 0.4)',
              border: '1px solid rgba(255, 255, 0, 0.8)',
              borderRadius: '2px',
              boxShadow: '0 0 4px rgba(255, 255, 0, 0.5)'
            }} />
          ))}
        </div>
      )}
      
      {/* SVG Annotation Overlay */}
      {(() => {
        const unW = rotation % 180 === 0 ? basePageWidth : basePageHeight;
        const unH = rotation % 180 === 0 ? basePageHeight : basePageWidth;
        const rotTransform = getRotationTransform(rotation, unW, unH);
        return (
          <svg 
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              cursor: ['Annotate', 'Shapes'].includes(activeTab) && activeTool ? (activeTool === 'eraser' ? 'cell' : 'crosshair') : 'default', 
              pointerEvents: (activeTool === null || activeTool === 'pan') ? 'none' : 'auto',
              zIndex: 10
            }}
            viewBox={`0 0 ${basePageWidth} ${basePageHeight}`}
            onMouseDown={(e) => onMouseDown(e, pageNum)}
            onMouseMove={(e) => onMouseMove(e, pageNum)}
            onMouseUp={(e) => onMouseUp(e, pageNum)}
            onMouseLeave={(e) => onMouseUp(e, pageNum)}
          >
            <g transform={rotTransform}>
              <React.Fragment>
                {pageAnnotations.map(ann => {
          const fillColor = (ann.type === 'text' || ann.type === 'callout') ? 'transparent' : `${ann.color}${Math.floor(ann.opacity * 255).toString(16).padStart(2, '0')}`;
          const strokeColor = ann.color;
          const isSelected = selectedAnnotationId === ann.id;
          const blendMode = (ann.type === 'highlight' || ann.opacity < 1) && !['text', 'note', 'callout', 'signature'].includes(ann.type) ? 'multiply' : 'normal';

          const interactionProps = {
            onMouseEnter: () => onAnnotationMouseEnter(ann.id),
            onClick: (e: React.MouseEvent) => {
              onAnnotationClick(ann.id, e);
            },
            style: { 
              pointerEvents: 'all' as any,
              cursor: activeTool === 'eraser' ? 'pointer' : 'pointer'
            }
          };

          let shape = null;

          if (ann.type === 'rectangle') {
            shape = <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill={fillColor} stroke={strokeColor} strokeWidth={ann.strokeWidth} style={{ mixBlendMode: blendMode }} />;
          } else if (ann.type === 'text' && ann.text) {
            shape = <text x={ann.x} y={ann.y + 16} fill={strokeColor} fontSize="16px" fontFamily="sans-serif">{ann.text}</text>;
          } else if (ann.type === 'ellipse') {
            shape = <ellipse cx={ann.x + ann.width/2} cy={ann.y + ann.height/2} rx={ann.width/2} ry={ann.height/2} fill={fillColor} stroke={strokeColor} strokeWidth={ann.strokeWidth} style={{ mixBlendMode: blendMode }} />;
          } else if (ann.type === 'line' && ann.points) {
            shape = (
              <g style={{ mixBlendMode: blendMode }}>
                <line x1={ann.points[0].x} y1={ann.points[0].y} x2={ann.points[1].x} y2={ann.points[1].y} stroke="transparent" strokeWidth={Math.max(10, ann.strokeWidth * 3)} />
                <line x1={ann.points[0].x} y1={ann.points[0].y} x2={ann.points[1].x} y2={ann.points[1].y} stroke={strokeColor} strokeWidth={ann.strokeWidth} />
              </g>
            );
          } else if (ann.type === 'arrow' && ann.points) {
            const [p1, p2] = ann.points;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const headLen = 15 + ann.strokeWidth;
            const h1 = { x: p2.x - headLen * Math.cos(angle - Math.PI / 6), y: p2.y - headLen * Math.sin(angle - Math.PI / 6) };
            const h2 = { x: p2.x - headLen * Math.cos(angle + Math.PI / 6), y: p2.y - headLen * Math.sin(angle + Math.PI / 6) };
            shape = (
              <g style={{ mixBlendMode: blendMode }}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={Math.max(10, ann.strokeWidth * 3)} />
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={ann.strokeWidth} />
                <path d={`M ${h1.x} ${h1.y} L ${p2.x} ${p2.y} L ${h2.x} ${h2.y}`} fill="none" stroke={strokeColor} strokeWidth={ann.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          } else if (ann.type === 'highlight' && ann.width !== undefined && ann.height !== undefined) {
            shape = <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill={strokeColor} opacity={ann.opacity} style={{ mixBlendMode: 'multiply' }} />;
          } else if (ann.type === 'link' && ann.width !== undefined && ann.height !== undefined) {
            if (ann.text) {
              const linkColor = ann.color && ann.color !== 'transparent' ? strokeColor : '#007bff';
              shape = (
                <text x={ann.x} y={ann.y + 16} fill={linkColor} fontSize="16px" fontFamily="sans-serif" textDecoration="underline" style={{ cursor: 'pointer' }}>
                  {ann.text}
                </text>
              );
            } else {
              const borderColor = ann.color && ann.color !== 'transparent' ? strokeColor : '#007bff';
              shape = <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height} fill="transparent" stroke={isSelected ? borderColor : `${borderColor}80`} strokeWidth={isSelected ? "2" : "1"} strokeDasharray={isSelected ? "none" : "4"} />;
            }
          } else if (ann.type === 'freehand' && ann.points) {
            const d = `M ${ann.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
            shape = (
              <g style={{ mixBlendMode: blendMode }}>
                <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(10, ann.strokeWidth * 3)} strokeLinejoin="round" strokeLinecap="round" />
                <path d={d} fill="none" stroke={strokeColor} strokeWidth={ann.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          } else if (ann.type === 'note') {
            shape = (
              <g transform={`translate(${ann.x}, ${ann.y})`}>
                <rect width="24" height="24" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth={ann.strokeWidth} />
                <path d="M6 12h12M6 8h12M6 16h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </g>
            );
          } else if (ann.type === 'callout' && ann.points) {
            shape = (
              <g>
                <line x1={ann.points[0].x} y1={ann.points[0].y} x2={ann.points[1].x} y2={ann.points[1].y} stroke={strokeColor} strokeWidth={ann.strokeWidth} strokeDasharray="4" />
                <rect x={ann.points[1].x} y={ann.points[1].y} width={ann.text ? ann.text.length * 8 + 20 : 100} height="24" fill="#fff" stroke={strokeColor} strokeWidth={ann.strokeWidth} />
                <text x={ann.points[1].x + 10} y={ann.points[1].y + 16} fill={strokeColor} fontSize="14px" fontFamily="sans-serif">{ann.text}</text>
              </g>
            );
          } else if (ann.type === 'signature' && ann.imageUrl) {
            const dateStr = ann.timestamp ? new Date(ann.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const signerText = ann.signer ? `Digitally signed by ${ann.signer} · ${dateStr}` : '';
            
            shape = (
              <g>
                <image href={ann.imageUrl} x={ann.x} y={ann.y} width={ann.width} height={ann.height} preserveAspectRatio="xMidYMid meet" />
                {signerText && (
                  <text 
                    x={(ann.x || 0) + (ann.width || 200) / 2} 
                    y={(ann.y || 0) + (ann.height || 60) + 16} 
                    fill="#666" 
                    fontSize="11px" 
                    fontFamily="sans-serif" 
                    textAnchor="middle"
                  >
                    {signerText}
                  </text>
                )}
              </g>
            );
          } else if (ann.type === 'digital_signature_placeholder') {
            const dateStr = ann.timestamp ? new Date(ann.timestamp).toLocaleString('en-GB') : '';
            const ax = ann.x || 0;
            const ay = ann.y || 0;
            const aw = ann.width || 350;
            const ah = ann.height || 70;
            const iconW = aw * 0.15;
            
            shape = (
              <g>
                <rect x={ax} y={ay} width={aw} height={ah} fill="rgba(255, 255, 255, 0.9)" stroke="#94a3b8" strokeWidth="1" />
                <line x1={ax + iconW} y1={ay} x2={ax + iconW} y2={ay + ah} stroke="#e2e8f0" strokeWidth="1" />
                
                {/* Shield Icon Approximation */}
                <g transform={`translate(${ax + iconW/2 - 12}, ${ay + ah/2 - 14})`}>
                  <path d="M22 6 L22 14 Q22 20 12 24 Q2 20 2 14 L2 6 L12 2 Z" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M7 13 L10 16 L17 8" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                
                <text x={ax + iconW + 10} y={ay + 25} fill="#0f172a" fontSize="11.5px" fontWeight="bold" fontFamily="sans-serif">
                  Digitally signed by {ann.signer || 'sanjiv@costacloud.com'}
                </text>
                <text x={ax + iconW + 10} y={ay + 42} fill="#334155" fontSize="10px" fontFamily="sans-serif">
                  Date: {dateStr}
                </text>
                <text x={ax + iconW + 10} y={ay + 57} fill="#334155" fontSize="10px" fontFamily="sans-serif">
                  Reason: Document Approval
                </text>
              </g>
            );
          }

          return (
            <g key={ann.id} {...interactionProps}>
              {shape}
              {isSelected && (
                <rect 
                  x={ann.x - 4} y={ann.y - 4} 
                  width={ann.width ? ann.width + 8 : 32} 
                  height={ann.height ? ann.height + 8 : 32} 
                  fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4" 
                />
              )}
            </g>
          );
        })}

        {redactions && redactions.filter(r => r.pageIndex === pageNum && r.status === 'pending').map((r, idx) => (
          <g 
            key={r.id || `pending-${idx}`} 
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onDiscardRedaction?.(r);
            }}
          >
            <title>Click to discard this redaction</title>
            <rect 
              x={r.x} 
              y={r.y} 
              width={r.width} 
              height={r.height} 
              fill="rgba(0, 0, 0, 0.45)" 
              stroke="#dc2626" 
              strokeWidth={2} 
              strokeDasharray="4"
            />
            <text 
              x={r.x + 4} 
              y={r.y + Math.min(r.height - 2, 14)} 
              fill="#ef4444" 
              fontSize="10px" 
              fontWeight="bold"
              letterSpacing="0.5px"
            >
              PENDING REDACTION
            </text>
            {/* Top-right Discard X Badge */}
            {r.width > 24 && r.height > 16 && (
              <g transform={`translate(${r.x + r.width - 18}, ${r.y + 2})`}>
                <rect width="16" height="16" rx="4" fill="#dc2626" />
                <path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
          </g>
        ))}
      </React.Fragment>
    </g>
          </svg>
        );
      })()}
    </div>
  );
}

const PageRenderer = React.memo(PageRendererComponent, (prevProps, nextProps) => {
  // If scale is <= 4, tiling is disabled. We can completely ignore scrollTop and scrollLeft changes!
  if (nextProps.scale <= 4 && prevProps.scale <= 4) {
    // Check all other props for equality
    return prevProps.pageNum === nextProps.pageNum &&
           prevProps.scale === nextProps.scale &&
           prevProps.rotation === nextProps.rotation &&
           prevProps.basePageWidth === nextProps.basePageWidth &&
           prevProps.basePageHeight === nextProps.basePageHeight &&
           prevProps.containerWidth === nextProps.containerWidth &&
           prevProps.containerHeight === nextProps.containerHeight &&
           prevProps.activeTab === nextProps.activeTab &&
           prevProps.activeTool === nextProps.activeTool &&
           prevProps.selectedAnnotationId === nextProps.selectedAnnotationId &&
           prevProps.activeSearchResult === nextProps.activeSearchResult &&
           prevProps.watermarkText === nextProps.watermarkText &&
           prevProps.redactions === nextProps.redactions &&
           prevProps.annotations === nextProps.annotations; // Assume reference equality for annotations is maintained
  }
  
  // If scale > 4, tiling is active, so we MUST re-render if scroll position changes significantly
  // (We check if it crossed an 800px boundary in the PageRenderer effect anyway, 
  // but to be safe we'll let React do its normal shallow compare if scale > 4)
  return prevProps.pageNum === nextProps.pageNum &&
         prevProps.scale === nextProps.scale &&
         prevProps.rotation === nextProps.rotation &&
         prevProps.basePageWidth === nextProps.basePageWidth &&
         prevProps.basePageHeight === nextProps.basePageHeight &&
         prevProps.containerWidth === nextProps.containerWidth &&
         prevProps.containerHeight === nextProps.containerHeight &&
         prevProps.scrollTop === nextProps.scrollTop &&
         prevProps.scrollLeft === nextProps.scrollLeft &&
         prevProps.activeTab === nextProps.activeTab &&
         prevProps.activeTool === nextProps.activeTool &&
         prevProps.selectedAnnotationId === nextProps.selectedAnnotationId &&
         prevProps.activeSearchResult === nextProps.activeSearchResult &&
         prevProps.watermarkText === nextProps.watermarkText &&
         prevProps.redactions === nextProps.redactions &&
         prevProps.annotations === nextProps.annotations;
});

export default PageRenderer;
