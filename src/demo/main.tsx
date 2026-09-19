/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Demo / iframe-package bootstrap. This file is the entry of the Vite *application* build
 * (`npm run build:app`, index.html) and is NOT part of the npm library.
 *
 * It keeps the historical script-tag behaviour: `window.WebViewer`, auto-mount into `#root`, the
 * `public/webviewer.js` iframe postMessage bridge, and a window <-> instance-bus relay so external
 * plugins that dispatch `action-*` window events keep working.
 */
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../index.css';
import './demo.css';
import { configurePdfAssets, createWebViewer, type WebViewerInstance, type WebViewerOptions } from '../index';

configurePdfAssets({ workerSrc });

// Expose globally for drop-in replacement script tags
(window as any).WebViewer = createWebViewer;

/** Event names relayed between `window` and the instance bus (both directions). */
const RELAYED_EVENTS = [
  'action-open-elements',
  'action-close-elements',
  'action-set-active-left-panel',
  'action-set-tool',
  'action-tool-changed',
  'action-fit-to-width',
  'action-fit-to-page',
  'action-focus-search',
  'action-download',
  'action-sign',
  'action-verify',
  'action-process-digital-signature',
  'action-commit-digital-signature',
  'action-commit-digital-signature-local',
  'action-waiting-for-pin-start',
  'action-waiting-for-pin-end',
  'action-waiting-for-pin-error',
  'action-start-compare',
  'action-stop-compare',
  'action-set-compare-mode',
  'action-set-compare-colors',
];

const RELAY_MARK = '__tspdfRelay';

function installWindowRelay(instance: WebViewerInstance): () => void {
  const offs: Array<() => void> = [];
  for (const name of RELAYED_EVENTS) {
    const windowHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object' && (detail as any)[RELAY_MARK]) return;
      instance.bus.emit(name, { ...(detail && typeof detail === 'object' ? detail : {}), [RELAY_MARK]: 'window' });
    };
    window.addEventListener(name, windowHandler);
    offs.push(() => window.removeEventListener(name, windowHandler));

    offs.push(
      instance.bus.on<any>(name, (detail) => {
        if (detail && typeof detail === 'object' && detail[RELAY_MARK] === 'window') return;
        window.dispatchEvent(new CustomEvent(name, { detail: { ...(detail ?? {}), [RELAY_MARK]: 'bus' } }));
      })
    );
  }
  return () => offs.forEach((off) => off());
}

async function mount(options: WebViewerOptions, el: HTMLElement): Promise<WebViewerInstance> {
  const instance = await createWebViewer({ autoFocus: true, ...options }, el);
  const uninstall = installWindowRelay(instance);
  instance.on('destroy', uninstall);
  return instance;
}

// Conversion service endpoint: uses same-origin proxy (/api/convert) to eliminate browser CORS preflight issues
const CONVERTER_ENDPOINT = '/api/convert';
const CONVERTER_BASIC_AUTH =
  'Basic ' + btoa('admin:ASDF!@!@#!@RDSDFF#$#@$SDFSD#@#@#SDFGDF$%^%$^DFG#$%#G#$%ERER%$%');

const defaultOfficeConverter = {
  endpoint: CONVERTER_ENDPOINT,
  headers: {
    Authorization: CONVERTER_BASIC_AUTH,
  },
  cache: 'memory' as const,
};

const rootElement = document.getElementById('root');
if (rootElement) {
  if (window !== window.parent) {
    // Running inside an iframe (packaged usage via public/webviewer.js)
    let trustedParentOrigin: string | null = null;

    // SEC-04: Safeguard regex strings against ReDoS before instantiating RegExp
    const MAX_REGEX_LEN = 250;
    const NESTED_QUANTIFIER_PATTERN = /\([^\)]*(\+|\*|\{[0-9]+,\})[^\)]*\)\s*(\+|\*|\{[0-9]+,\})/;

    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'INIT') return;
      const { options } = event.data;

      // SEC-03: Validate origin against allowedOrigins if specified, and bind trustedOrigin
      const senderOrigin = event.origin;
      const allowedOrigins: string[] | undefined = options?.allowedOrigins;
      if (allowedOrigins && Array.isArray(allowedOrigins)) {
        if (!allowedOrigins.includes(senderOrigin) && !allowedOrigins.includes('*')) {
          console.warn('[teamsync-pdf-viewer] Rejecting INIT from unauthorized origin:', senderOrigin);
          return;
        }
      }
      trustedParentOrigin = senderOrigin === 'null' ? '*' : senderOrigin;

      const safeRegexRedactions: RegExp[] = [];
      if (Array.isArray(options?.regexRedactions)) {
        for (const rStr of options.regexRedactions) {
          if (typeof rStr !== 'string' || rStr.length > MAX_REGEX_LEN) {
            console.warn('[teamsync-pdf-viewer] Skipping invalid or excessively long regex pattern');
            continue;
          }
          if (NESTED_QUANTIFIER_PATTERN.test(rStr)) {
            console.warn('[teamsync-pdf-viewer] Skipping potentially catastrophic backtracking regex pattern:', rStr);
            continue;
          }
          try {
            const match = rStr.match(/^\/(.*)\/([a-z]*)$/);
            if (match) {
              safeRegexRedactions.push(new RegExp(match[1], match[2] || ''));
            } else {
              safeRegexRedactions.push(new RegExp(rStr));
            }
          } catch (e) {
            console.warn('[teamsync-pdf-viewer] Failed to compile regex redaction pattern:', rStr, e);
          }
        }
      }

      mount({ officeConverter: defaultOfficeConverter, ...options, regexRedactions: safeRegexRedactions }, rootElement).then((instance) => {
        const targetOrigin = trustedParentOrigin || '*';
        window.parent.postMessage('VIEWER_INITIALIZED', targetOrigin);

        window.addEventListener('message', async (cmdEvent) => {
          // SEC-03: Only process commands originating from the verified initializing parent
          if (trustedParentOrigin && trustedParentOrigin !== '*' && cmdEvent.origin !== trustedParentOrigin) {
            console.warn('[teamsync-pdf-viewer] Ignoring command from untrusted origin:', cmdEvent.origin);
            return;
          }

          if (cmdEvent.data?.type === 'CORE_EXPORT_ANNOTATIONS') {
            // The iframe protocol predates XFDF support and expects the JSON annotation list.
            const anns = instance.Core.annotationManager.exportAnnotationsLegacyJson();
            window.parent.postMessage({ type: 'EXPORT_ANNOTATIONS_RESULT', annotations: JSON.parse(anns) }, targetOrigin);
          } else if (cmdEvent.data?.type === 'CORE_GET_FILE_DATA') {
            const data = await instance.getFileData();
            window.parent.postMessage({ type: 'GET_FILE_DATA_RESULT', data }, targetOrigin);
          }
        });
      });
    });

    window.parent.postMessage('VIEWER_READY', '*');
  } else {
    // Standalone dev / demo mode (supports ?file=, ?doc=, or ?compare=true query param)
    const searchParams = new URLSearchParams(window.location.search);
    const customDoc = searchParams.get('file') || searchParams.get('doc');
    const isCompareInitial = searchParams.get('compare') === 'true';

    const SAMPLES: Array<{
      id: string;
      name: string;
      badge: string;
      color: string;
      url?: string;
      fileName?: string;
      isCompare?: boolean;
    }> = [
      {
        id: 'pdf',
        name: 'TeamSync Manual',
        badge: 'PDF',
        color: '#e11d48',
        url: '/TeamSync.pdf?v=2',
        fileName: 'TeamSync.pdf',
      },
      {
        id: 'word',
        name: 'Word Document',
        badge: 'DOCX',
        color: '#185abd',
        url: '/api/convert?file=/sample_document.docx',
        fileName: 'sample_document.docx',
      },
      {
        id: 'excel',
        name: 'Excel Spreadsheet',
        badge: 'XLSX',
        color: '#107c41',
        url: '/api/convert?file=/sample_spreadsheet.xlsx',
        fileName: 'sample_spreadsheet.xlsx',
      },
      {
        id: 'ppt',
        name: 'PowerPoint Deck',
        badge: 'PPTX',
        color: '#d24726',
        url: '/api/convert?file=/sample_presentation.pptx',
        fileName: 'sample_presentation.pptx',
      },
      {
        id: 'compare',
        name: 'Compare PDF',
        badge: 'DIFF',
        color: '#0284c7',
        isCompare: true,
      },
    ];

    let currentDocUrl = customDoc || SAMPLES[0].url!;
    let viewerInstance: WebViewerInstance | null = null;

    // Create layout wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;';

    // Top switcher bar
    const bar = document.createElement('div');
    bar.className = 'teamsync-demo-bar';

    const brand = document.createElement('div');
    brand.className = 'teamsync-demo-brand';
    brand.innerHTML = `
      <span>TeamSync PDF Viewer</span>
      <span class="teamsync-demo-badge-live">LIVE DEMO</span>
      <span class="teamsync-demo-badge-hybrid" title="Hybrid Architecture: Edge CDN Pre-Conversion for system documents + on-the-fly client fallback for local files">⚡ HYBRID ENGINE</span>
    `;
    bar.appendChild(brand);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'teamsync-demo-buttons';

    const buttons: HTMLButtonElement[] = [];

    SAMPLES.forEach((sample) => {
      const btn = document.createElement('button');
      const isInitial = sample.isCompare
        ? isCompareInitial
        : !isCompareInitial && (sample.url === currentDocUrl || (customDoc && customDoc.includes(sample.id)));
      btn.className = `teamsync-demo-btn ${isInitial ? 'active' : ''}`;
      btn.innerHTML = `<span class="teamsync-doc-badge" style="background: ${sample.color}">${sample.badge}</span> <span>${sample.name}</span>`;

      btn.onclick = () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        if (sample.isCompare) {
          window.dispatchEvent(
            new CustomEvent('action-start-compare', {
              detail: {
                docA: '/sample_v1.pdf',
                docB: '/sample_v2.pdf',
                options: { mode: 'side-by-side' },
              },
            })
          );
          const u = new URL(window.location.href);
          u.searchParams.set('compare', 'true');
          u.searchParams.delete('file');
          u.searchParams.delete('doc');
          window.history.replaceState(null, '', u.toString());
        } else {
          window.dispatchEvent(new CustomEvent('action-stop-compare'));
          if (sample.url) {
            currentDocUrl = sample.url;
            if (viewerInstance) {
              viewerInstance.loadDocument(sample.url);
            }
            const u = new URL(window.location.href);
            u.searchParams.set('file', sample.url);
            u.searchParams.delete('compare');
            window.history.replaceState(null, '', u.toString());
          }
        }
      };

      buttons.push(btn);
      buttonsContainer.appendChild(btn);
    });

    window.addEventListener('action-stop-compare', () => {
      const compareIdx = SAMPLES.findIndex((s) => s.isCompare);
      if (compareIdx !== -1) buttons[compareIdx]?.classList.remove('active');
      const curIdx = SAMPLES.findIndex((s) => s.url === currentDocUrl);
      if (curIdx !== -1) buttons[curIdx]?.classList.add('active');
      const u = new URL(window.location.href);
      u.searchParams.delete('compare');
      window.history.replaceState(null, '', u.toString());
    });

    bar.appendChild(buttonsContainer);

    const viewerEl = document.createElement('div');
    viewerEl.style.cssText = 'flex: 1; min-height: 0; width: 100%; position: relative;';

    wrapper.appendChild(bar);
    wrapper.appendChild(viewerEl);
    rootElement.appendChild(wrapper);

    const cleanFileName =
      currentDocUrl.split('#')[0].split('?')[0].split('/').pop() || 'document.pdf';

    mount(
      {
        initialDoc: currentDocUrl,
        fileName: cleanFileName,
        initialScale: 'fit-width',
        currentUser: { id: 'demo', name: 'Demo User' },
        officeConverter: defaultOfficeConverter,
        watermark: {
          text: 'CONFIDENTIAL',
          opacity: 0.1,
          mode: 'single',
          size: 48,
          color: '#dc2626',
        },
      },
      viewerEl
    ).then((instance) => {
      viewerInstance = instance;
      if (isCompareInitial) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('action-start-compare', {
              detail: {
                docA: '/sample_v1.pdf',
                docB: '/sample_v2.pdf',
                options: { mode: 'side-by-side' },
              },
            })
          );
        }, 300);
      }
    });
  }
}
