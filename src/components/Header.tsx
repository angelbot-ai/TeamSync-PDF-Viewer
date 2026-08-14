/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, PanelLeft,
  Hand, Search, MessageSquare, 
  FileText, Download, Maximize, Save, Printer, Settings, Info,
  MinusCircle, PlusCircle, Maximize2, MoveHorizontal, ChevronUp, ChevronDown, ScanSearch,
  FileCode2, File, Copy, Expand, RotateCw, RotateCcw, ShieldCheck, Pen
} from 'lucide-react';

import type { SDKPermissions } from '../main';
import type { ViewerPlugin } from '../plugins/types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  sidebarTab: 'Comments' | 'Search';
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomSet: (scale: number) => void;
  onDownload: () => void;
  onFullScreen: () => void;
  onSaveAs: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenSidebarTab: (tab: 'Comments' | 'Search') => void;
  pageTransition: 'continuous' | 'page-by-page';
  setPageTransition: (t: 'continuous' | 'page-by-page') => void;
  pageLayout: 'single' | 'double' | 'cover-facing';
  setPageLayout: (l: 'single' | 'double' | 'cover-facing') => void;
  rotation: number;
  setRotation: (r: number) => void;
  signatureCount?: number;
  enableAnnotations?: boolean;
  enableSign?: boolean;
  plugins?: ViewerPlugin[];
  permissions?: SDKPermissions;
}

const TABS = [
  'View', 'Annotate'
];

export default function Header({ 
  activeTab, setActiveTab, 
  leftSidebarOpen, setLeftSidebarOpen,
  rightSidebarOpen, setRightSidebarOpen: _setRightSidebarOpen,
  sidebarTab,
  scale, onZoomIn, onZoomOut, onZoomSet,
  onDownload, onFullScreen, onSaveAs, onOpenSettings, onOpenAbout, onOpenSidebarTab,
  pageTransition, setPageTransition, pageLayout, setPageLayout, rotation, setRotation,
  signatureCount = 0,
  enableAnnotations,
  enableSign = false,
  plugins,
  permissions
}: HeaderProps) {
  const hasSignPlugin = plugins && plugins.some(p => p.id && p.id.toLowerCase().includes('sign'));
  const isSignVisible = enableSign === true && Boolean(hasSignPlugin);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [headerTool, setHeaderTool] = useState<string | null>('pan');
  const menuRef = useRef<HTMLDivElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const viewSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleToolChanged = (e: any) => setHeaderTool(e.detail.tool);
    window.addEventListener('action-tool-changed', handleToolChanged);
    
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(event.target as Node)) {
        setIsZoomMenuOpen(false);
      }
      if (viewSettingsRef.current && !viewSettingsRef.current.contains(event.target as Node)) {
        setIsViewSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener('action-tool-changed', handleToolChanged);
    };
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--toolbar-bg)',
      color: 'var(--text-color)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '48px',
        padding: '0 8px'
      }}>
        {/* Left Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <IconButton icon={<Menu size={18} />} title="Menu" onClick={() => setIsMenuOpen(!isMenuOpen)} active={isMenuOpen} />
            {isMenuOpen && (
              <div style={{ 
                position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                width: '220px', zIndex: 1000, display: 'flex', flexDirection: 'column',
                border: '1px solid var(--border-color)', overflow: 'hidden'
              }}>
                <MenuOption icon={<Download size={16} />} label="Download" onClick={() => { onDownload(); setIsMenuOpen(false); }} />
                <MenuOption icon={<Maximize size={16} />} label="Enter Full Screen" onClick={() => { onFullScreen(); setIsMenuOpen(false); }} />
                <MenuOption icon={<Save size={16} />} label="Save As" onClick={() => { onSaveAs(); setIsMenuOpen(false); }} />
                <MenuOption icon={<Printer size={16} />} label="Print" disabled />
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                <MenuOption icon={<Settings size={16} />} label="Settings" onClick={() => { onOpenSettings(); setIsMenuOpen(false); }} />
              </div>
            )}
          </div>
          <IconButton 
            icon={<PanelLeft size={18} />} 
            title="Toggle Left Panel"
            active={leftSidebarOpen}
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} 
          />
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
          <div ref={viewSettingsRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <IconButton 
                icon={
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} />
                    <div style={{ position: 'absolute', right: '-4px', bottom: '-4px', backgroundColor: '#fff', borderRadius: '50%', padding: '1px' }}>
                      <Settings size={10} color="var(--primary)" />
                    </div>
                  </div>
                } 
                title="View Settings"
                active={isViewSettingsOpen}
                onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)} 
              />
            </div>
            {isViewSettingsOpen && (
              <div style={{ 
                position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                width: '240px', zIndex: 1000, display: 'flex', flexDirection: 'column',
                border: '1px solid var(--border-color)', overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px 8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>Page Transition</div>
                <MenuOption 
                  icon={<FileCode2 size={16} />} 
                  label="Continuous Page" 
                  selected={pageTransition === 'continuous'}
                  onClick={() => { setPageTransition('continuous'); setIsViewSettingsOpen(false); }} 
                />
                <MenuOption 
                  icon={<File size={16} />} 
                  label="Page By Page" 
                  selected={pageTransition === 'page-by-page'}
                  onClick={() => { setPageTransition('page-by-page'); setIsViewSettingsOpen(false); }} 
                />
                
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                
                <div style={{ padding: '12px 16px 8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>Page Orientation</div>
                <MenuOption 
                  icon={<RotateCw size={16} />} 
                  label="Rotate Clockwise" 
                  onClick={() => { setRotation((rotation + 90) % 360); setIsViewSettingsOpen(false); }} 
                />
                <MenuOption 
                  icon={<RotateCcw size={16} />} 
                  label="Rotate Counterclockwise" 
                  onClick={() => { setRotation((rotation - 90 + 360) % 360); setIsViewSettingsOpen(false); }} 
                />
                
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                <div style={{ padding: '12px 16px 8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>Page Layout</div>
                <MenuOption 
                  icon={<File size={16} />} 
                  label="Single Page" 
                  selected={pageLayout === 'single'}
                  onClick={() => { setPageLayout('single'); setIsViewSettingsOpen(false); }} 
                />
                <MenuOption 
                  icon={<Copy size={16} />} 
                  label="Double Page" 
                  selected={pageLayout === 'double'}
                  onClick={() => { setPageLayout('double'); setIsViewSettingsOpen(false); }} 
                />
                <MenuOption 
                  icon={<FileText size={16} />} 
                  label="Cover Facing Page" 
                  selected={pageLayout === 'cover-facing'}
                  onClick={() => { setPageLayout('cover-facing'); setIsViewSettingsOpen(false); }} 
                />

                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                <MenuOption 
                  icon={<Expand size={16} />} 
                  label="Enter Full Screen" 
                  onClick={() => { onFullScreen(); setIsViewSettingsOpen(false); }} 
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div ref={zoomMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', 
                borderRadius: '4px', border: isZoomMenuOpen ? '1px solid var(--primary)' : '1px solid transparent',
                cursor: 'pointer', userSelect: 'none', height: '32px'
              }}>
                <div 
                  onClick={() => setIsZoomMenuOpen(!isZoomMenuOpen)}
                  style={{ 
                    padding: '0 8px 0 12px', fontSize: '13px', fontWeight: 500, 
                    display: 'flex', alignItems: 'center', height: '100%'
                  }}
                >
                  {Math.round(scale * 100)}%
                </div>
                <div 
                  onClick={() => setIsZoomMenuOpen(!isZoomMenuOpen)}
                  style={{ 
                    padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%',
                    borderLeft: '1px solid #e5e7eb', color: isZoomMenuOpen ? 'var(--primary)' : 'var(--text-color)'
                  }}
                >
                  {isZoomMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              
              {isZoomMenuOpen && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                  backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  width: '180px', zIndex: 1000, display: 'flex', flexDirection: 'column',
                  border: '1px solid var(--border-color)', overflow: 'hidden', padding: '8px 0'
                }}>
                  <MenuOption icon={<MoveHorizontal size={16} />} label="Fit To Width" onClick={() => { if(onZoomSet) onZoomSet(1.5); setIsZoomMenuOpen(false); }} />
                  <MenuOption icon={<Maximize2 size={16} />} label="Fit To Page" onClick={() => { if(onZoomSet) onZoomSet(0.8); setIsZoomMenuOpen(false); }} />
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                  {[0.1, 0.25, 0.5, 1, 1.25, 1.5, 2, 4, 8, 16, 32, 64].map(zoomLevel => (
                    <div 
                      key={zoomLevel}
                      onClick={() => { if(onZoomSet) onZoomSet(zoomLevel); setIsZoomMenuOpen(false); }}
                      style={{ 
                        padding: '6px 44px', fontSize: '13px', cursor: 'pointer', 
                        backgroundColor: scale === zoomLevel ? '#f3f4f6' : '#fff'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = scale === zoomLevel ? '#f3f4f6' : '#fff'}
                    >
                      {Math.round(zoomLevel * 100)}%
                    </div>
                  ))}
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                  <MenuOption icon={<ScanSearch size={16} />} label="Marquee Zoom" onClick={() => setIsZoomMenuOpen(false)} />
                </div>
              )}
            </div>
            <IconButton icon={<MinusCircle size={18} color="var(--text-muted)" />} title="Zoom Out" onClick={onZoomOut} />
            <IconButton icon={<PlusCircle size={18} color="var(--text-muted)" />} title="Zoom In" onClick={onZoomIn} />
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
          <IconButton icon={<Hand size={18} />} title="Pan Tool" active={headerTool === 'pan'} onClick={() => window.dispatchEvent(new CustomEvent('action-set-tool', { detail: { tool: 'pan' } }))} />
        </div>

        {/* Center Section: Tabs */}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: '16px' }}>
          {TABS.filter(tab => !(tab === 'Annotate' && (enableAnnotations === false || permissions?.canAddAnnotations === false))).map(tab => (
            <div 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === tab ? 500 : 400,
                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '0 4px'
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Sign Button */}
          {isSignVisible && (
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('action-sign'))}
              style={{ 
                background: '#fff0f0', border: '1px solid #d32f2f', color: '#d32f2f', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                height: '32px', padding: '0 12px', borderRadius: '4px', cursor: 'pointer',
                fontWeight: 600, fontSize: '13px'
              }}
            >
              <Pen size={14} color="#d32f2f" fill="#d32f2f" />
              Sign
            </button>
          )}
          
          {/* Verify Button (Only visible if signed) */}
          {signatureCount > 0 && (
            <div 
              onClick={() => window.dispatchEvent(new CustomEvent('action-verify'))}
              style={{ 
                backgroundColor: '#10b981', color: '#000', 
                borderRadius: '16px', padding: '4px 12px', 
                display: 'flex', alignItems: 'center', gap: '6px', 
                cursor: 'pointer', fontWeight: 600, fontSize: '13px'
              }}
              title="Verify Signatures"
            >
              <ShieldCheck size={16} /> Signed · {signatureCount}
            </div>
          )}

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          <IconButton 
            icon={<Info size={18} />} 
            title="About / Info"
            onClick={onOpenAbout} 
          />

          <IconButton 
            icon={<Search size={18} />} 
            title="Search"
            active={rightSidebarOpen && sidebarTab === 'Search'}
            onClick={() => onOpenSidebarTab('Search')} 
          />
          <IconButton 
            icon={<MessageSquare size={18} />} 
            title="Comments"
            active={rightSidebarOpen && sidebarTab === 'Comments'}
            onClick={() => onOpenSidebarTab('Comments')} 
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({ icon, onClick, active = false, title }: { icon: React.ReactNode, onClick?: () => void, active?: boolean, title?: string }) {
  return (
    <button 
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: active ? '#e6f0fa' : 'transparent',
        color: active ? 'var(--primary)' : 'inherit',
        cursor: 'pointer',
        outline: 'none',
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

function MenuOption({ icon, label, onClick, disabled = false, selected = false }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, selected?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(!disabled)}
      onMouseLeave={() => setHovered(false)}
      style={{ 
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', 
        cursor: disabled ? 'default' : 'pointer', color: disabled ? '#ccc' : (selected ? '#fff' : 'var(--text-color)'),
        backgroundColor: disabled ? 'transparent' : (selected ? 'var(--primary)' : (hovered ? '#f5f5f5' : 'transparent')),
        fontSize: '13px'
      }}
    >
      <div style={{ color: disabled ? '#ccc' : (selected ? '#fff' : 'var(--text-muted)') }}>{icon}</div>
      <span>{label}</span>
    </div>
  );
}
