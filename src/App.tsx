/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState } from 'react';
import Header from './components/Header';
import DocumentViewer from './components/DocumentViewer';
import SettingsModal from './components/SettingsModal';
import SignTypeModal from './components/SignTypeModal';
import VerificationModal from './components/VerificationModal';
import AboutModal from './components/AboutModal';

import type { Redaction, WatermarkOptions, SDKPermissions } from './main';

interface AppProps {
  initialDoc?: string;
  initialScale?: number;
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
  onAnnotationsChange?: (annotations: any[]) => void;
}

function App({ 
  initialDoc, initialScale, redactions, regexRedactions, enableAnnotations, 
  enableSign = true, signOptions = ['digital', 'ades', 'simple'],
  initialPage, watermark, permissions, enableRedactions,
  canAddAnnotations, canEditAnnotations, canDeleteAnnotations,
  onAnnotationsChange 
}: AppProps) {
  const effectivePermissions: SDKPermissions = {
    canAddAnnotations: permissions?.canAddAnnotations ?? canAddAnnotations ?? (enableAnnotations !== false),
    canEditAnnotations: permissions?.canEditAnnotations ?? canEditAnnotations ?? (enableAnnotations !== false),
    canDeleteAnnotations: permissions?.canDeleteAnnotations ?? canDeleteAnnotations ?? (enableAnnotations !== false),
    canRedact: permissions?.canRedact ?? enableRedactions ?? true,
  };

  // If annotations are disabled, force activeTab to View
  const [activeTab, setActiveTab] = useState(effectivePermissions.canAddAnnotations === false ? 'View' : 'View');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'Comments' | 'Search'>('Comments');
  const [scale, setScale] = useState(initialScale ?? 1.0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // View Settings State
  const [pageTransition, setPageTransition] = useState<'continuous' | 'page-by-page'>('continuous');
  const [pageLayout, setPageLayout] = useState<'single' | 'double' | 'cover-facing'>('single');
  const [rotation, setRotation] = useState<number>(0);
  const [watermarkText, setWatermarkText] = useState<string>('user@example.com - Confidential');
  const [annotations, setAnnotations] = useState<any[]>([]);

  // Signature Modals State
  const [isSignTypeModalOpen, setIsSignTypeModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  const signatures = annotations.filter(a => a.type === 'signature');

  // Listen for header events
  React.useEffect(() => {
    const handleSign = () => {
      const allowed: ('digital' | 'ades' | 'simple')[] = signOptions && signOptions.length > 0 ? signOptions : ['digital', 'ades', 'simple'];
      if (allowed.length === 1) {
        handleSignTypeSelect(allowed[0]);
      } else {
        setIsSignTypeModalOpen(true);
      }
    };
    const handleVerify = () => setIsVerifyModalOpen(true);
    const handleOpenElements = (e: any) => {
      const elements = e.detail.elements || [];
      if (elements.includes('leftPanel')) setLeftSidebarOpen(true);
      if (elements.includes('notesPanel')) {
        setRightSidebarOpen(true);
        setSidebarTab('Comments');
      }
      if (elements.includes('searchPanel')) {
        setRightSidebarOpen(true);
        setSidebarTab('Search');
      }
    };
    const handleCloseElements = (e: any) => {
      const elements = e.detail.elements || [];
      if (elements.includes('leftPanel')) setLeftSidebarOpen(false);
      if (elements.includes('notesPanel') || elements.includes('searchPanel')) setRightSidebarOpen(false);
    };
    const handleSetActiveLeftPanel = (e: any) => {
      const panel = e.detail.panel;
      if (panel === 'notesPanel') {
        setRightSidebarOpen(true);
        setSidebarTab('Comments');
      } else if (panel === 'searchPanel') {
        setRightSidebarOpen(true);
        setSidebarTab('Search');
      } else {
        setLeftSidebarOpen(true);
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept Cmd+F or Ctrl+F
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setRightSidebarOpen(true);
        setSidebarTab('Search');
        
        // Small timeout to allow sidebar to render if it was closed
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('action-focus-search'));
        }, 50);
      }
    };

    window.addEventListener('action-sign', handleSign);
    window.addEventListener('action-verify', handleVerify);
    window.addEventListener('action-open-elements', handleOpenElements);
    window.addEventListener('action-close-elements', handleCloseElements);
    window.addEventListener('action-set-active-left-panel', handleSetActiveLeftPanel);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('action-sign', handleSign);
      window.removeEventListener('action-verify', handleVerify);
      window.removeEventListener('action-open-elements', handleOpenElements);
      window.removeEventListener('action-close-elements', handleCloseElements);
      window.removeEventListener('action-set-active-left-panel', handleSetActiveLeftPanel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [signOptions]);

  const handleSignTypeSelect = (type: 'digital' | 'ades' | 'simple') => {
    setIsSignTypeModalOpen(false);
    window.dispatchEvent(new CustomEvent('action-start-signature', { detail: { type } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header 
        activeTab={activeTab} setActiveTab={(tab) => {
          if (effectivePermissions.canAddAnnotations === false && tab === 'Annotate') return;
          setActiveTab(tab);
        }}
        leftSidebarOpen={leftSidebarOpen} setLeftSidebarOpen={setLeftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen} setRightSidebarOpen={setRightSidebarOpen}
        sidebarTab={sidebarTab}
        scale={scale} onZoomIn={() => setScale(s => Math.min(s + 0.25, 5))} onZoomOut={() => setScale(s => Math.max(s - 0.25, 0.5))} onZoomSet={setScale}
        onDownload={() => window.dispatchEvent(new Event('action-download'))}
        onFullScreen={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
          }
        }}
        onSaveAs={() => window.dispatchEvent(new Event('action-download'))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onOpenSidebarTab={(tab) => { setRightSidebarOpen(true); setSidebarTab(tab); }}
        pageTransition={pageTransition} setPageTransition={setPageTransition}
        pageLayout={pageLayout} setPageLayout={setPageLayout}
        rotation={rotation} setRotation={setRotation}
        signatureCount={signatures.length}
        enableAnnotations={enableAnnotations}
        enableSign={enableSign}
        permissions={effectivePermissions}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DocumentViewer 
          leftSidebarOpen={leftSidebarOpen}
          rightSidebarOpen={rightSidebarOpen}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          activeTab={activeTab} 
          initialDoc={initialDoc} 
          redactions={redactions}
          regexRedactions={regexRedactions}
          scale={scale} 
          setScale={setScale}
          onAnnotationsChange={(anns) => {
            setAnnotations(anns);
            if (onAnnotationsChange) onAnnotationsChange(anns);
          }} 
          pageTransition={pageTransition}
          pageLayout={pageLayout}
          rotation={rotation}
          setRotation={setRotation}
          watermark={watermark}
          watermarkText={watermarkText} // keep for backwards compatibility / SettingsModal
          enableAnnotations={enableAnnotations}
          initialPage={initialPage}
          permissions={effectivePermissions}
        />
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} watermarkText={watermarkText} setWatermarkText={setWatermarkText} />}
      {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
      {isSignTypeModalOpen && (
        <SignTypeModal 
          fileName={initialDoc?.split('/').pop() || 'Document.pdf'}
          userEmail="sanjiv@costacloud.com"
          allowedSignTypes={signOptions}
          onClose={() => setIsSignTypeModalOpen(false)}
          onSignNow={handleSignTypeSelect}
        />
      )}
      {isVerifyModalOpen && (
        <VerificationModal 
          fileName={initialDoc?.split('/').pop() || 'Document.pdf'}
          signatures={signatures}
          onClose={() => setIsVerifyModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
