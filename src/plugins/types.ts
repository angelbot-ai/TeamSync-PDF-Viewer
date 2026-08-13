import React from 'react';

export interface PluginContext {
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
  annotations: any[];
  setAnnotations: React.Dispatch<React.SetStateAction<any[]>>;
  commitAnnotations: (anns: any[]) => void;
  scale: number;
  pdfDoc: any;
  permissions?: any;
  initialDoc?: string;
  watermark?: any;
}

export interface ViewerPlugin {
  id: string;
  name: string;
  // Header action button slot (e.g. Sign button)
  renderHeaderActions?: (context: PluginContext) => React.ReactNode;
  // Modal dialog injection slot
  renderModals?: (context: PluginContext) => React.ReactNode;
  // Event initialization hook
  onInit?: (context: PluginContext) => void;
  // Document save / export middleware
  onBeforeSave?: (pdfBytes: Uint8Array, context: PluginContext) => Promise<Uint8Array>;
}

export interface DigitalSignerOptions {
  allowedTypes?: Array<'digital' | 'ades' | 'simple'>;
  usbBridgeUrl?: string;
  defaultSignerName?: string;
}
