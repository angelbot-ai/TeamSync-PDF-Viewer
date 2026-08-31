# 🚀 Getting Started Guide

This guide covers installing and setting up **TeamSync PDF Viewer SDK** in your React / TypeScript applications.

---

## 📦 1. Installation

```bash
# npm
npm install teamsync-pdf-viewer pdfjs-dist

# yarn
yarn add teamsync-pdf-viewer pdfjs-dist

# pnpm
pnpm add teamsync-pdf-viewer pdfjs-dist
```

`react`, `react-dom` (18 or 19) and `pdfjs-dist` (6.x) are peer dependencies.

---

## 🧩 2. Serve the pdf.js assets

The viewer does not bundle the pdf.js worker. Tell it where the worker (and optionally CMaps,
standard fonts and wasm decoders) are served from — once, before the first document is opened:

```ts
import { configurePdfAssets } from 'teamsync-pdf-viewer';

// Vite: let the bundler emit the worker as an asset
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
configurePdfAssets({ workerSrc });

// Next.js / static hosting: copy node_modules/pdfjs-dist/{build/pdf.worker.min.mjs,cmaps,standard_fonts,wasm}
// into public/pdfjs/ at build time, then:
configurePdfAssets({
  workerSrc: '/pdfjs/pdf.worker.min.mjs',
  cMapUrl: '/pdfjs/cmaps/',
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
});
```

You can also pass the same object as the `assets` prop of `<TeamSyncViewer>`.

---

## 💻 3. Basic Setup Examples

### React Component (`<TeamSyncViewer />`)

```tsx
import React from 'react';
import { TeamSyncViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

export function PDFApp() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <TeamSyncViewer
        fileUrl="/sample.pdf"
        fileName="sample.pdf"
        initialScale="fit-width"
        permissions={{ canRedact: true, canAddAnnotations: true }}
        onDocumentLoaded={({ numPages }) => console.log(`${numPages} pages`)}
      />
    </div>
  );
}
```

The component fills its container (`width: 100%; height: 100%`), so give the parent a size.

**Next.js App Router:** put the viewer in a client component (`'use client'`) or load it with
`next/dynamic(..., { ssr: false })`. Importing the package is side-effect free, so a server-rendered
page that merely imports it will not crash.

### Imperative API (`createWebViewer(...)`)

```typescript
import { createWebViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

const container = document.getElementById('viewer-container')!;

const instance = await createWebViewer({
  initialDoc: '/sample.pdf',
  initialScale: 1.0,
  enableAnnotations: true,
  permissions: { canRedact: true },
}, container);

instance.on('documentLoaded', (info) => console.log('loaded', info));

// later
instance.destroy();
```

`WebViewer(...)` is still exported as a deprecated alias.

---

## 🔁 4. Reloading and expiring URLs

Presigned URLs expire. Handle load errors by minting a fresh URL and retrying:

```tsx
<TeamSyncViewer
  fileUrl={url}
  onDocumentLoadError={async (error, retry, { passwordRequired }) => {
    if (passwordRequired) return; // show your own message / download link
    const fresh = await mintPresignedUrl();
    retry(fresh);
  }}
/>
```

`instance.loadDocument(url)` does the same imperatively.
