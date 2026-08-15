/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'

// Use worker from local public directory or CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface Redaction {
  id?: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: 'pending' | 'applied';
}

export interface WatermarkOptions {
  text: string;
  opacity?: number;
  size?: number;
  mode?: 'single' | 'tiled';
  color?: string;
}

export interface SDKPermissions {
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;
  canRedact?: boolean;
}

import type { ViewerPlugin } from './plugins';

export interface WebViewerOptions {
  path?: string;
  initialDoc?: string;
  initialScale?: number;
  plugins?: ViewerPlugin[];
  redactions?: Redaction[];
  regexRedactions?: RegExp[];
  enableAnnotations?: boolean;
  enableSign?: boolean;
  signOptions?: ('digital' | 'ades' | 'simple')[];
  initialPage?: number;
  watermark?: WatermarkOptions;
  permissions?: SDKPermissions;
  enableRedactions?: boolean;
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;
  // ... other legacy options
}

export class WebViewerInstance {
  container: HTMLElement;
  getAnnotations: () => any[];
  initialDoc?: string;
  redactions?: Redaction[];
  regexRedactions?: RegExp[];
  enableAnnotations?: boolean;
  enableSign?: boolean;
  signOptions?: ('digital' | 'ades' | 'simple')[];
  initialPage?: number;
  watermark?: WatermarkOptions;
  permissions?: SDKPermissions;
  enableRedactions?: boolean;
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;

  constructor(
    container: HTMLElement,
    getAnnotations: () => any[],
    initialDoc?: string,
    redactions?: Redaction[],
    regexRedactions?: RegExp[],
    enableAnnotations?: boolean,
    enableSign?: boolean,
    signOptions?: ('digital' | 'ades' | 'simple')[],
    initialPage?: number,
    watermark?: WatermarkOptions,
    permissions?: SDKPermissions,
    enableRedactions?: boolean,
    canAddAnnotations?: boolean,
    canEditAnnotations?: boolean,
    canDeleteAnnotations?: boolean
  ) {
    this.container = container;
    this.getAnnotations = getAnnotations;
    this.initialDoc = initialDoc;
    this.redactions = redactions;
    this.regexRedactions = regexRedactions;
    this.enableAnnotations = enableAnnotations;
    this.enableSign = enableSign;
    this.signOptions = signOptions;
    this.initialPage = initialPage;
    this.watermark = watermark;
    this.permissions = permissions;
    this.enableRedactions = enableRedactions;
    this.canAddAnnotations = canAddAnnotations;
    this.canEditAnnotations = canEditAnnotations;
    this.canDeleteAnnotations = canDeleteAnnotations;
  }

  // Mock API for drop-in replacement compatibility
  UI = {
    setTheme: (_theme: string) => {},
    openElements: (elements: string[]) => {
      window.dispatchEvent(new CustomEvent('action-open-elements', { detail: { elements } }));
    },
    closeElements: (elements: string[]) => {
      window.dispatchEvent(new CustomEvent('action-close-elements', { detail: { elements } }));
    },
    enableElements: (elements: string[]) => {
      window.dispatchEvent(new CustomEvent('action-open-elements', { detail: { elements } }));
    },
    disableElements: (elements: string[]) => {
      window.dispatchEvent(new CustomEvent('action-close-elements', { detail: { elements } }));
    },
    setActiveLeftPanel: (panel: string) => {
      window.dispatchEvent(new CustomEvent('action-set-active-left-panel', { detail: { panel } }));
    },
    fitWidth: () => {
      window.dispatchEvent(new CustomEvent('action-fit-to-width'));
    },
    fitPage: () => {
      window.dispatchEvent(new CustomEvent('action-fit-to-page'));
    },
    fitToWidth: () => {
      window.dispatchEvent(new CustomEvent('action-fit-to-width'));
    },
    fitToPage: () => {
      window.dispatchEvent(new CustomEvent('action-fit-to-page'));
    }
  };

  Core = {
    annotationManager: {
      exportAnnotations: () => {
        const anns = this.getAnnotations();
        return JSON.stringify(anns, null, 2);
      }
    },
    documentViewer: {
      addEventListener: (_event: string, _callback: () => void) => {},
      getDocument: () => ({
        getFileData: async (options?: { xfdfString?: string, explicitAnnotations?: any[] }) => {
          if (!this.initialDoc) throw new Error("No document loaded");
          
          // 1. Check file size to prevent OOM on massive files (>500MB)
          try {
            const headRes = await fetch(this.initialDoc, { method: 'HEAD' });
            const contentLength = headRes.headers.get('Content-Length');
            if (contentLength) {
              const sizeMB = parseInt(contentLength, 10) / (1024 * 1024);
              if (sizeMB > 500) {
                throw new Error(`File is too large (${sizeMB.toFixed(2)} MB) to save directly in the browser. Please use exportAnnotations() to save annotation data and apply it on your server.`);
              }
            }
          } catch (e: any) {
            if (e.message.includes('too large')) throw e;
            // Otherwise, HEAD request might not be supported, proceed at own risk
            console.warn("Could not check file size before loading.");
          }

          // 2. Fetch the original PDF
          const response = await fetch(this.initialDoc);
          const arrayBuffer = await response.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const pages = pdfDoc.getPages();
          
          const anns = options?.explicitAnnotations || this.getAnnotations();
          
          // Draw annotations
          // Note: pdf-lib uses a coordinate system where (0,0) is bottom-left.
          // The canvas uses top-left. We need to convert Y coordinates.
          
          // These conversions are simplistic and assume scale=1.5. 
          // In a real implementation, we'd calculate exact page matrix transforms.
          const scale = 1.5;

          // Helper to parse hex to pdf-lib rgb
          const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return rgb(r, g, b);
          };

          for (const ann of anns) {
            // Resolve the correct target page (pageIndex is 1-based)
            const targetPageIdx = Math.max(0, Math.min((ann.pageIndex || 1) - 1, pages.length - 1));
            const page = pages[targetPageIdx];
            const { height } = page.getSize();
            
            const color = hexToRgb(ann.color || '#000000');
            const opacity = ann.opacity || 1;
            const strokeWidth = ann.strokeWidth || 1;

            if (ann.type === 'rectangle') {
              page.drawRectangle({
                x: ann.x / scale,
                y: height - (ann.y / scale) - (ann.height / scale),
                width: ann.width / scale,
                height: ann.height / scale,
                color: color,
                opacity: opacity,
                borderColor: color,
                borderWidth: strokeWidth
              });
            } else if (ann.type === 'text' && ann.text) {
              // Basic text drawing
              page.drawText(ann.text, {
                x: ann.x / scale,
                y: height - (ann.y / scale) - 16,
                size: 16 / scale,
                color: color,
                opacity: opacity
              });
            } else if (ann.type === 'ellipse') {
              page.drawEllipse({
                x: (ann.x + ann.width/2) / scale,
                y: height - ((ann.y + ann.height/2) / scale),
                xScale: (ann.width/2) / scale,
                yScale: (ann.height/2) / scale,
                color: color,
                opacity: opacity,
                borderColor: color,
                borderWidth: strokeWidth
              });
            } else if (ann.type === 'line' && ann.points) {
              page.drawLine({
                start: { x: ann.points[0].x / scale, y: height - (ann.points[0].y / scale) },
                end: { x: ann.points[1].x / scale, y: height - (ann.points[1].y / scale) },
                color: color,
                opacity: opacity,
                thickness: strokeWidth
              });
            } else if (ann.type === 'freehand' && ann.points && ann.points.length > 0) {
              const d = `M ${ann.points.map((p: any) => `${p.x / scale},${height - (p.y / scale)}`).join(' L ')}`;
              page.drawSvgPath(d, {
                borderColor: color,
                borderWidth: strokeWidth,
                opacity: opacity,
              });
            } else if (ann.type === 'note') {
              // Draw small yellow square and text
              page.drawRectangle({
                x: ann.x / scale,
                y: height - (ann.y / scale) - 24,
                width: 24,
                height: 24,
                color: rgb(1, 0.97, 0.7), // #fff8b4
                borderColor: color,
                borderWidth: strokeWidth
              });
              if (ann.text) {
                page.drawText(ann.text, {
                  x: (ann.x + 30) / scale,
                  y: height - (ann.y / scale) - 16,
                  size: 14 / scale,
                  color: color,
                  opacity: opacity
                });
              }
            } else if (ann.type === 'callout' && ann.points) {
              page.drawLine({
                start: { x: ann.points[0].x / scale, y: height - (ann.points[0].y / scale) },
                end: { x: ann.points[1].x / scale, y: height - (ann.points[1].y / scale) },
                color: color,
                opacity: opacity,
                thickness: strokeWidth
              });
              if (ann.text) {
                page.drawRectangle({
                  x: ann.points[1].x / scale,
                  y: height - (ann.points[1].y / scale) - 20,
                  width: (ann.text.length * 8 + 20) / scale,
                  height: 24 / scale,
                  color: rgb(1, 1, 1),
                  borderColor: color,
                  borderWidth: strokeWidth
                });
                page.drawText(ann.text, {
                  x: (ann.points[1].x + 10) / scale,
                  y: height - (ann.points[1].y / scale) - 14,
                  size: 14 / scale,
                  color: color,
                  opacity: opacity
                });
              }
            } else if (ann.type === 'signature' && ann.imageUrl) {
              const imageBytes = await fetch(ann.imageUrl).then(res => res.arrayBuffer());
              const image = await pdfDoc.embedPng(imageBytes);
              page.drawImage(image, {
                x: ann.x / scale,
                y: height - (ann.y / scale) - (ann.height / scale),
                width: ann.width / scale,
                height: ann.height / scale,
              });
            } else if (ann.type === 'digital_signature_placeholder') {
              const rectX = ann.x / scale;
              const rectW = ann.width / scale;
              const rectH = ann.height / scale;
              const rectY = height - (ann.y / scale) - rectH;
              
              const dateStr = ann.timestamp ? new Date(ann.timestamp).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
              const iconW = rectW * 0.15;

              // White Background & Border
              page.drawRectangle({
                x: rectX, y: rectY, width: rectW, height: rectH,
                color: rgb(1, 1, 1),
                borderColor: rgb(148/255, 163/255, 184/255),
                borderWidth: 1
              });

              // Separator Line
              page.drawLine({
                start: { x: rectX + iconW, y: rectY },
                end: { x: rectX + iconW, y: rectY + rectH },
                color: rgb(226/255, 232/255, 240/255),
                thickness: 1
              });

              // Shield Icon (Simple representation for PDF)
              page.drawSvgPath("M22 6 L22 14 Q22 20 12 24 Q2 20 2 14 L2 6 L12 2 Z", {
                x: rectX + iconW/2 - 12,
                y: rectY + rectH/2 + 12,
                borderColor: rgb(2/255, 132/255, 199/255),
                borderWidth: 2,
                scale: 1
              });
              page.drawSvgPath("M7 13 L10 16 L17 8", {
                x: rectX + iconW/2 - 12,
                y: rectY + rectH/2 + 12,
                borderColor: rgb(2/255, 132/255, 199/255),
                borderWidth: 2,
                scale: 1
              });

              // Text
              page.drawText(`Digitally signed by ${ann.signer || 'sanjiv@costacloud.com'}`, {
                x: rectX + iconW + 10, y: rectY + rectH - 16,
                size: 10, color: rgb(15/255, 23/255, 42/255)
              });
              page.drawText(`Date: ${dateStr}`, {
                x: rectX + iconW + 10, y: rectY + rectH - 28,
                size: 9, color: rgb(51/255, 65/255, 85/255)
              });
              page.drawText(`Reason: Document Approval`, {
                x: rectX + iconW + 10, y: rectY + rectH - 40,
                size: 9, color: rgb(51/255, 65/255, 85/255)
              });
            }
          }
          // --- SDK Watermark Baking ---
          if (this.watermark?.text) {
            const wm = this.watermark;
            const wmColorHex = wm.color || '#737373';
            const wmColor = hexToRgb(wmColorHex);
            const wmOpacity = wm.opacity ?? 0.08;
            
            // Embed font to get exact text measurements
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            for (const page of pages) {
              const { width, height } = page.getSize();
              
              if (wm.mode === 'single') {
                const fontSize = wm.size || 48;
                const textWidth = helveticaFont.widthOfTextAtSize(wm.text, fontSize);
                
                // Calculate rotation offset to perfectly center the text
                const cx = width / 2;
                const cy = height / 2;
                const angle = -Math.PI / 4;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                
                // Center of text relative to its bottom-left origin
                const dx = -textWidth / 2;
                const dy = -fontSize * 0.35; // approximate vertical center above baseline
                
                const rotatedDx = dx * cosA - dy * sinA;
                const rotatedDy = dx * sinA + dy * cosA;
                
                page.drawText(wm.text, {
                  x: cx + rotatedDx,
                  y: cy + rotatedDy,
                  size: fontSize,
                  font: helveticaFont,
                  color: wmColor,
                  opacity: wmOpacity,
                  rotate: degrees(-45),
                });
              } else {
                const fontSize = wm.size || 18;
                const textWidth = helveticaFont.widthOfTextAtSize(wm.text, fontSize);
                const xStep = textWidth + 150;
                const yStep = 250;
                
                // Calculate rotation offset for tiled centers
                const angle = -Math.PI / 4;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const dx = -textWidth / 2;
                const dy = -fontSize * 0.35;
                const rotatedDx = dx * cosA - dy * sinA;
                const rotatedDy = dx * sinA + dy * cosA;
                
                // Draw diagonally across a wide bounding box
                for (let y = -height; y < height * 2; y += yStep) {
                  const offset = (Math.abs(y / yStep) % 2) * (xStep / 2);
                  for (let x = -width; x < width * 2; x += xStep) {
                    const cx = x + offset;
                    const cy = y;
                    
                    page.drawText(wm.text, {
                      x: cx + rotatedDx,
                      y: cy + rotatedDy,
                      size: fontSize,
                      font: helveticaFont,
                      color: wmColor,
                      opacity: wmOpacity,
                      rotate: degrees(-45),
                    });
                  }
                }
              }
            }
          }

          // --- Secure Rasterization for Redactions ---
          let combinedRedactions = this.redactions || [];
          if ((window as any).currentAutoRedactions) {
             combinedRedactions = [...combinedRedactions, ...(window as any).currentAutoRedactions];
          }
          if ((window as any).currentManualRedactions) {
             combinedRedactions = [...combinedRedactions, ...(window as any).currentManualRedactions];
          }

          let finalDoc = pdfDoc;

          if (combinedRedactions && combinedRedactions.length > 0) {
            // We must rasterize redacted pages to prevent text extraction
            
            // Generate a temporary buffer to render from
            const tempBuffer = await pdfDoc.save();
            const loadingTask = pdfjsLib.getDocument({ data: tempBuffer });
            const renderDoc = await loadingTask.promise;
            
            const flattenedPdf = await PDFDocument.create();
            
            for (let i = 1; i <= renderDoc.numPages; i++) {
              const hasRedactions = combinedRedactions.some(r => r.pageIndex === i);
              
              if (hasRedactions) {
                // Rasterize this page
                const renderPage = await renderDoc.getPage(i);
                
                // Use a high scale for good quality print/download
                const scale = 2.0;
                const viewport = renderPage.getViewport({ scale });
                
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                  await renderPage.render({
                    canvasContext: ctx,
                    canvas: canvas,
                    viewport: viewport
                  }).promise;
                  
                  // Apply redactions onto the canvas
                  ctx.save();
                  ctx.fillStyle = '#000000';
                  const pageRedactions = combinedRedactions.filter(r => r.pageIndex === i);
                  
                  for (const redaction of pageRedactions) {
                    const vX = redaction.x * scale;
                    const vY = redaction.y * scale;
                    const vW = redaction.width * scale;
                    const vH = redaction.height * scale;
                    
                    ctx.fillRect(Math.floor(vX), Math.floor(vY), Math.ceil(vW), Math.ceil(vH));
                  }
                  ctx.restore();
                  
                  // Convert canvas to image and add to new PDF
                  const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
                  const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());
                  const pdfImage = await flattenedPdf.embedJpg(imgBytes);
                  
                  // Original PDF coordinates (for page dimensions)
                  const originalVp = renderPage.getViewport({ scale: 1 });
                  const newPage = flattenedPdf.addPage([originalVp.width, originalVp.height]);
                  
                  newPage.drawImage(pdfImage, {
                    x: 0,
                    y: 0,
                    width: originalVp.width,
                    height: originalVp.height
                  });
                  
                  // Free GPU-backed canvas bitmap memory immediately
                  canvas.width = 0;
                  canvas.height = 0;
                }
                renderPage.cleanup();
              } else {
                // No redactions, just copy the page from the original doc
                const [copiedPage] = await flattenedPdf.copyPages(pdfDoc, [i - 1]);
                flattenedPdf.addPage(copiedPage);
              }
              
              // Yield to main thread every 5 pages so UI doesn't freeze on huge documents
              if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
            finalDoc = flattenedPdf;
          }

          return await finalDoc.save();
        }
      })
    }
  };
}

export const WebViewer = (options: WebViewerOptions, viewerElement: HTMLElement): Promise<WebViewerInstance> => {
  return new Promise((resolve) => {
    let currentAnnotations: any[] = [];
    
    const root = ReactDOM.createRoot(viewerElement);
    
    const app = <App 
      initialDoc={options.initialDoc} 
      initialScale={options.initialScale}
      redactions={options.redactions || []} 
      regexRedactions={options.regexRedactions}
      enableAnnotations={options.enableAnnotations}
      enableSign={options.enableSign}
      plugins={options.plugins}
      signOptions={options.signOptions}
      initialPage={options.initialPage}
      watermark={options.watermark}
      permissions={options.permissions}
      enableRedactions={options.enableRedactions}
      canAddAnnotations={options.canAddAnnotations}
      canEditAnnotations={options.canEditAnnotations}
      canDeleteAnnotations={options.canDeleteAnnotations}
      onAnnotationsChange={(anns) => { currentAnnotations = anns; }}
    />;
    
    root.render(app);

    const instance = new WebViewerInstance(
      viewerElement,
      () => currentAnnotations,
      options.initialDoc,
      options.redactions,
      options.regexRedactions,
      options.enableAnnotations,
      options.enableSign,
      options.signOptions,
      options.initialPage,
      options.watermark,
      options.permissions,
      options.enableRedactions,
      options.canAddAnnotations,
      options.canEditAnnotations,
      options.canDeleteAnnotations
    );

    window.addEventListener('action-download', async () => {
      try {
        let data = (window as any).cachedSignedPdfBytes;
        if (data) {
          (window as any).cachedSignedPdfBytes = null; // Consume the cache
        } else {
          data = await instance.Core.documentViewer.getDocument().getFileData();
        }
        if (!data) return;
        const blob = new Blob([data as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotated_document.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err: any) {
        alert("Download failed: " + err.message);
      }
    });

    window.addEventListener('action-process-digital-signature', async (e: any) => {
      try {
        const { pageIndex, x, y, width, height } = e.detail;
        
        // 1. Temporarily add the placeholder to the instance annotations so getFileData() includes it.
        const originalAnnotations = instance.getAnnotations();
        const tempAnn = { 
          id: Date.now().toString(), type: 'digital_signature_placeholder', pageIndex,
          x, y, width, height, color: '#0f172a', strokeWidth: 1, opacity: 1,
          signer: 'sanjiv@costacloud.com', timestamp: Date.now()
        };
        const explicitAnnotations = [...originalAnnotations, tempAnn];
        
        // 2. Call getFileData with the explicit annotations
        window.dispatchEvent(new CustomEvent('action-waiting-for-pin-start'));
        const data = await instance.Core.documentViewer.getDocument().getFileData({ explicitAnnotations });
        window.dispatchEvent(new CustomEvent('action-waiting-for-pin-end'));
        
        if (!data) return;
        
        // 3. Cache the signed bytes so the Download button can use them instead of asking for PIN again
        (window as any).cachedSignedPdfBytes = data;
        
        // 4. Finally, commit the signature to the UI!
        window.dispatchEvent(new CustomEvent('action-commit-digital-signature', { detail: { tempAnn } }));
        
      } catch (err: any) {
        window.dispatchEvent(new CustomEvent('action-waiting-for-pin-error', { detail: { error: err.message } }));
        console.error("Process signature failed:", err);
        // Handled internally by getFileData alerts. The UI will not place the block.
      }
    });

    // Resolve with mock instance mimicking legacy API
    resolve(instance);
  });
};

// Expose globally for drop-in replacement script tags
// Expose globally for drop-in replacement script tags
(window as any).WebViewer = WebViewer;

// Auto-mount for dev environment OR iframe package mode
const rootElement = document.getElementById('root');
if (rootElement) {
  if (window !== window.parent) {
    // We are running inside an iframe (Packaged usage via webviewer.js)
    
    window.addEventListener('message', (event) => {
      // 1. Listen for INIT message containing options
      if (event.data.type === 'INIT') {
        const { options } = event.data;
        
        // Reconstruct regexes
        const regexRedactions = options.regexRedactions?.map((rStr: string) => {
          const match = rStr.match(/^\/(.*)\/([a-z]*)$/);
          if (match) return new RegExp(match[1], match[2] || '');
          return new RegExp(rStr);
        });

        // 2. Initialize the WebViewer instance
        WebViewer({
          ...options,
          regexRedactions
        }, rootElement).then((instance) => {
          // Signal wrapper that initialization is complete
          window.parent.postMessage('VIEWER_INITIALIZED', '*');
          
          // Listen for core commands from the wrapper
          window.addEventListener('message', async (cmdEvent) => {
            if (cmdEvent.data.type === 'CORE_EXPORT_ANNOTATIONS') {
              const anns = instance.Core.annotationManager.exportAnnotations();
              window.parent.postMessage({ type: 'EXPORT_ANNOTATIONS_RESULT', annotations: JSON.parse(anns) }, '*');
            } else if (cmdEvent.data.type === 'CORE_GET_FILE_DATA') {
              const data = await instance.Core.documentViewer.getDocument().getFileData();
              window.parent.postMessage({ type: 'GET_FILE_DATA_RESULT', data }, '*');
            }
          });
        });
      }
    });

    // 0. Signal the host wrapper that our JS has loaded and we are ready for INIT
    window.parent.postMessage('VIEWER_READY', '*');
    
  } else {
    // We are running standalone (Dev Mode)
    WebViewer({ 
      initialDoc: '/TeamSync.pdf?v=2',
      watermark: {
        text: 'CONFIDENTIAL',
        opacity: 0.1,
        mode: 'single', // Change to 'tiled' to test tiled mode
        size: 48,
        color: '#dc2626'
      }
    }, rootElement);
  }
}
