# 🔌 Plugin Architecture Guide

Extend **TeamSync PDF Viewer** with custom extension plugins.

---

## 🏛️ Extension Slots

- **`renderHeaderActions(context)`**: Injects custom toolbar buttons.
- **`renderModals(context)`**: Injects custom modal dialogs into the viewer lifecycle.
- **`onBeforeSave(pdfBytes, context)`**: Middleware to transform exported PDF bytes.

---

## 💻 Writing a Plugin

```typescript
import React from 'react';
import type { ViewerPlugin, PluginContext } from '@angelbot-ai/teamsync-pdf-viewer';

export function CustomPlugin(): ViewerPlugin {
  return {
    id: 'my-custom-plugin',
    name: 'Custom Extension',
    renderHeaderActions: (context: PluginContext) => (
      <button onClick={() => alert('Custom action triggered!')}>
        Custom Button
      </button>
    )
  };
}
```
