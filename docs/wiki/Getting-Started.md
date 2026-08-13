# 🚀 Getting Started Guide

This guide covers installing and setting up **TeamSync PDF Viewer SDK** in your React / TypeScript applications.

---

## 📦 1. Installation

Install the package using your preferred package manager:

```bash
# Using npm
npm install @angelbot-ai/teamsync-pdf-viewer

# Using yarn
yarn add @angelbot-ai/teamsync-pdf-viewer

# Using pnpm
pnpm add @angelbot-ai/teamsync-pdf-viewer
```

---

## 💻 2. Basic Setup Examples

### React Component (`<DocumentViewer />`)

```tsx
import React from 'react';
import { DocumentViewer } from '@angelbot-ai/teamsync-pdf-viewer';
import '@angelbot-ai/teamsync-pdf-viewer/style.css';

export function PDFApp() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DocumentViewer
        initialDoc="/sample.pdf"
        scale={1.0}
        enableAnnotations={true}
        permissions={{
          canRedact: true,
          canAddAnnotations: true
        }}
      />
    </div>
  );
}
```

### WebViewer API (`WebViewer(...)`)

```typescript
import { WebViewer } from '@angelbot-ai/teamsync-pdf-viewer';
import '@angelbot-ai/teamsync-pdf-viewer/style.css';

const container = document.getElementById('viewer-container');

WebViewer({
  initialDoc: '/sample.pdf',
  initialScale: 1.0,
  enableAnnotations: true,
  permissions: {
    canRedact: true
  }
}, container!).then((instance) => {
  console.log('WebViewer initialized:', instance);
});
```
