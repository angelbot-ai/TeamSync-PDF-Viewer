/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
/**
 * Drop-in replacement for Legacy WebViewer wrapper.
 */
export default function WebViewer(options, viewerElement) {
  return new Promise((resolve, reject) => {
    // 1. Create the iframe
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    // 2. Construct the URL to our built Vite app (index.html)
    const basePath = options.path || '/lib';
    iframe.src = `${basePath}/index.html`;
    viewerElement.appendChild(iframe);

    // 3. Establish the Mock Legacy Instance API
    const instance = {
      iframeWindow: iframe.contentWindow,
      UI: {
        setTheme: (theme) => iframe.contentWindow.postMessage({ type: 'UI_SET_THEME', theme }, '*'),
        openElements: (elements) => iframe.contentWindow.postMessage({ type: 'UI_OPEN_ELEMENTS', elements }, '*'),
        closeElements: (elements) => iframe.contentWindow.postMessage({ type: 'UI_CLOSE_ELEMENTS', elements }, '*'),
        enableElements: (elements) => iframe.contentWindow.postMessage({ type: 'UI_OPEN_ELEMENTS', elements }, '*'),
        disableElements: (elements) => iframe.contentWindow.postMessage({ type: 'UI_CLOSE_ELEMENTS', elements }, '*'),
        setActiveLeftPanel: (panel) => iframe.contentWindow.postMessage({ type: 'UI_SET_ACTIVE_LEFT_PANEL', panel }, '*')
      },
      Core: {
        annotationManager: {
          exportAnnotations: () => {
            return new Promise((res) => {
              const listener = (event) => {
                if (event.source !== iframe.contentWindow) return;
                if (event.data.type === 'EXPORT_ANNOTATIONS_RESULT') {
                  window.removeEventListener('message', listener);
                  res(event.data.annotations);
                }
              };
              window.addEventListener('message', listener);
              iframe.contentWindow.postMessage({ type: 'CORE_EXPORT_ANNOTATIONS' }, '*');
            });
          }
        },
        documentViewer: {
          getDocument: () => ({
            getFileData: () => {
              return new Promise((res) => {
                const listener = (event) => {
                  if (event.source !== iframe.contentWindow) return;
                  if (event.data.type === 'GET_FILE_DATA_RESULT') {
                    window.removeEventListener('message', listener);
                    res(event.data.data);
                  }
                };
                window.addEventListener('message', listener);
                iframe.contentWindow.postMessage({ type: 'CORE_GET_FILE_DATA' }, '*');
              });
            }
          })
        }
      }
    };

    // Wait for the React app inside the iframe to signal it is ready
    const messageListener = (event) => {
      if (event.source !== iframe.contentWindow) return;
      
      if (event.data === 'VIEWER_READY') {
        // Prepare options (stringify regexes since they can't be cloned directly via postMessage)
        const serializedOptions = {
          ...options,
          regexRedactions: options.regexRedactions 
            ? options.regexRedactions.map(r => r.toString()) 
            : []
        };
        
        iframe.contentWindow.postMessage({ 
          type: 'INIT', 
          options: serializedOptions 
        }, '*');
      } else if (event.data === 'VIEWER_INITIALIZED') {
        window.removeEventListener('message', messageListener);
        resolve(instance);
      }
    };
    
    window.addEventListener('message', messageListener);
  });
}
