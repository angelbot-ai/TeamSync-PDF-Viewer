/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Imperative entry point: mounts <TeamSyncViewer> into an element and resolves with the instance.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { TeamSyncViewer } from '../components/TeamSyncViewer';
import type { WebViewerInstance } from './ViewerInstance';
import type { WebViewerOptions } from './types';

export function createWebViewer(options: WebViewerOptions, viewerElement: HTMLElement): Promise<WebViewerInstance> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('[teamsync-pdf-viewer] createWebViewer() requires a browser environment.'));
  }
  if (!viewerElement) {
    return Promise.reject(new Error('[teamsync-pdf-viewer] createWebViewer() needs a container element.'));
  }

  return new Promise((resolve) => {
    const root = ReactDOM.createRoot(viewerElement);
    const { path: _path, ...rest } = options;
    root.render(
      <TeamSyncViewer
        {...rest}
        style={{ width: '100%', height: '100%' }}
        onReady={(instance) => {
          instance._setUnmount(() => root.unmount());
          resolve(instance);
        }}
      />
    );
  });
}

/** @deprecated Use `createWebViewer`. Kept as an alias for drop-in compatibility. */
export const WebViewer = createWebViewer;
