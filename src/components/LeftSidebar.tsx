/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Copy, List, Bookmark, MoreHorizontal, CheckSquare, Minus, Plus } from 'lucide-react';

interface ThumbnailProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageIndex: number;
  isActive: boolean;
  onClick: () => void;
  scale: number;
}

const Thumbnail = ({ pdfDoc, pageIndex, isActive, onClick, scale }: ThumbnailProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(0.77); // Default to roughly 8.5x11

  // Use IntersectionObserver to only render thumbnails that are near the viewport
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }, { rootMargin: '500px' });
    
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex);
        if (isCancelled) return;
        
        // Update aspect ratio based on actual page size
        const vp = page.getViewport({ scale: 1 });
        setAspectRatio(vp.width / vp.height);

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvasContext: ctx,
          canvas: canvas,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          viewport: viewport
        });
        await renderTask.promise;
      } catch (e: any) {
        if (e.name !== 'RenderingCancelledException') {
          console.error("Thumbnail render error", e);
        }
      }
    };
    
    renderPage();
    
    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageIndex, scale, isVisible]);

  // Base width is usually around 800 at scale 1. So we calculate a dummy width based on scale.
  const estimatedWidth = 800 * scale;
  const estimatedHeight = estimatedWidth / aspectRatio;

  return (
    <div 
      ref={containerRef}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
        padding: '8px', boxSizing: 'border-box',
        minHeight: `${estimatedHeight + 30}px` // +30 for the text label
      }}
    >
      {isVisible ? (
        <div style={{
          border: isActive ? '2px solid var(--primary)' : '1px solid #ccc',
          padding: '2px', backgroundColor: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <canvas ref={canvasRef} style={{ display: 'block', backgroundColor: '#fff' }} />
        </div>
      ) : (
        <div style={{
          width: `${estimatedWidth}px`, height: `${estimatedHeight}px`,
          backgroundColor: '#eaeaea', border: '1px solid #ccc'
        }} />
      )}
      <span style={{ marginTop: '8px', fontSize: '12px', color: isActive ? 'var(--primary)' : '#555', fontWeight: isActive ? 'bold' : 'normal' }}>
        {pageIndex}
      </span>
    </div>
  );
};

interface LeftSidebarProps {
  isOpen: boolean;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNum: number;
  setPageNum: (p: number) => void;
}

export default function LeftSidebar({ isOpen, pdfDoc, pageNum, setPageNum }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<'Thumbnails' | 'Outline' | 'Bookmarks'>('Thumbnails');
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  
  // Slider goes from 0 (small) to 100 (large)
  const [zoomPercent, setZoomPercent] = useState(30); 
  
  // Convert 0-100 to a pdfjs scale (e.g. 0.1 to 0.4)
  const thumbScale = 0.1 + (zoomPercent / 100) * 0.3;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 150), 500);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const numPages = pdfDoc ? pdfDoc.numPages : 0;
  
  // Generate array [1, 2, ..., numPages]
  const pagesArray = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div style={{
      width: isOpen ? `${sidebarWidth}px` : '0px',
      height: '100%',
      backgroundColor: '#f9fafb',
      display: 'flex',
      flexShrink: 0,
      zIndex: 10,
      transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      borderRight: isOpen ? '1px solid var(--border-color)' : 'none'
    }}>
      <div style={{
        width: `${sidebarWidth}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Top Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '4px'
        }}>
          <button 
            onClick={() => setActiveTab('Thumbnails')}
            style={{ flex: 1, padding: '8px', background: activeTab === 'Thumbnails' ? 'var(--primary)' : 'none', color: activeTab === 'Thumbnails' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Page Thumbnails"
          >
            <Copy size={16} />
          </button>
          <button 
            onClick={() => setActiveTab('Outline')}
            style={{ flex: 1, padding: '8px', background: activeTab === 'Outline' ? 'var(--primary)' : 'none', color: activeTab === 'Outline' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Document Outline"
          >
            <List size={16} />
          </button>
          <button 
            onClick={() => setActiveTab('Bookmarks')}
            style={{ flex: 1, padding: '8px', background: activeTab === 'Bookmarks' ? 'var(--primary)' : 'none', color: activeTab === 'Bookmarks' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Bookmarks"
          >
            <Bookmark size={16} />
          </button>
          <button 
            style={{ flex: 1, padding: '8px', background: 'none', color: 'var(--text-muted)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="More Options"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {activeTab === 'Thumbnails' && (
          <>
            {/* Zoom Slider */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: '8px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
              <Minus size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setZoomPercent(Math.max(0, zoomPercent - 10))} />
              <input 
                type="range" 
                min="0" max="100" 
                value={zoomPercent} 
                onChange={(e) => setZoomPercent(parseInt(e.target.value))}
                style={{ flex: 1, height: '4px', accentColor: 'var(--primary)' }}
              />
              <Plus size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setZoomPercent(Math.min(100, zoomPercent + 10))} />
            </div>

            {/* Thumbnails List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', backgroundColor: '#f1f1f1' }}>
              {pdfDoc && pagesArray.map(p => (
                <Thumbnail 
                  key={p} 
                  pdfDoc={pdfDoc} 
                  pageIndex={p} 
                  isActive={p === pageNum} 
                  onClick={() => setPageNum(p)}
                  scale={thumbScale}
                />
              ))}
              {!pdfDoc && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                  No document loaded
                </div>
              )}
            </div>

            {/* Multi-Select Footer */}
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-color)', marginBottom: '8px' }}>
                Multi-Select Pages - e.g. 1, 3, 5-10
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text"
                  placeholder="e.g. 1, 3, 5-10"
                  style={{ flex: 1, padding: '6px 8px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}
                />
                <button style={{ padding: '6px 8px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <CheckSquare size={16} color="var(--text-color)" />
                </button>
              </div>
            </div>
          </>
        )}
        
        {activeTab !== 'Thumbnails' && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
            No content available for {activeTab}.
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={() => setIsResizing(true)}
        style={{
          width: '6px',
          height: '100%',
          position: 'absolute',
          right: '-3px',
          cursor: 'col-resize',
          zIndex: 20
        }}
      />
    </div>
  );
}
