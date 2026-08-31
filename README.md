# TeamSync PDF Viewer SDK

Client-side PDF viewing, annotation, search, redaction and watermarking for React — built on
[pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/).

<div align="center">

![TeamSync PDF Viewer UI](https://raw.githubusercontent.com/angelbot-ai/TeamSync-PDF-Viewer/main/docs/images/viewer_ui.png)

[![License: CPAL-1.0](https://img.shields.io/badge/License-CPAL--1.0-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-pdfviewer.teamsync.com-000000.svg)](https://pdfviewer.teamsync.com/)
[![npm](https://img.shields.io/npm/v/teamsync-pdf-viewer.svg)](https://www.npmjs.com/package/teamsync-pdf-viewer)
[![React 18/19](https://img.shields.io/badge/React-18%20%7C%2019-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-types%20included-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## Features

- **Viewing** — continuous or page-by-page scrolling, single / double / cover-facing layouts,
  thumbnails panel, zoom 10 % – 6400 % with fit-to-width / fit-to-page, pinch and wheel zoom,
  rotation, pan tool, high-DPI canvas rendering, progressive loading of linearized PDFs (HTTP Range).
- **Text** — real selectable text layer, client-side search with highlighting and a results panel.
- **Annotations** — highlighter, freehand ink, shapes (rectangle, ellipse, line, arrow), text,
  sticky notes, callouts, hyperlinks (page-jump or URL), signature images, undo/redo, keyboard shortcuts.
- **Redaction** — manual and regex/PII-driven redactions, burned in on export by rasterizing the
  affected pages so the underlying content is destroyed; redacted text is also stripped from the
  text layer and search index.
- **Watermarks** — single or tiled forensic watermarks, rendered live and baked on export.
- **Export** — download the annotated / redacted / watermarked document; no server round-trip.
- **Embeddable** — `<TeamSyncViewer>` sizes to its container, several viewers can share a page,
  keyboard shortcuts apply to the focused viewer only, and importing the package is side-effect free
  (safe under SSR).

Not yet supported: printing (planned for 1.2), AcroForm filling, rendering of annotations already
embedded in the PDF, document outline/bookmarks, password prompts (password-protected files raise
`onPasswordRequired`).

---

## Installation

```bash
npm install teamsync-pdf-viewer pdfjs-dist
```

`react`, `react-dom` (18 or 19) and `pdfjs-dist` (6.x) are **peer dependencies**. `pdf-lib` and
`lucide-react` are installed automatically.

### Serve the pdf.js assets

The library never bundles the pdf.js worker (bundling it produced a 5 MB package with a `data:`
URL worker that strict Content-Security-Policies reject). Serve the worker — and, for full font /
CJK / JPEG 2000 support, the CMaps, standard fonts and wasm decoders — from your own origin and tell
the viewer where they are.

**Vite / Rollup**

```ts
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { configurePdfAssets } from 'teamsync-pdf-viewer';

configurePdfAssets({ workerSrc });
```

**Next.js (or any static host)** — copy the files at build time and reference them by URL:

```bash
# e.g. in a prebuild script
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdfjs/
cp -r node_modules/pdfjs-dist/cmaps node_modules/pdfjs-dist/standard_fonts node_modules/pdfjs-dist/wasm public/pdfjs/
```

```ts
configurePdfAssets({
  workerSrc: '/pdfjs/pdf.worker.min.mjs',
  cMapUrl: '/pdfjs/cmaps/',
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
});
```

The worker **must** come from the same `pdfjs-dist` version the viewer runs against
(`import { pdfjsVersion } from 'teamsync-pdf-viewer'` tells you which one is loaded).

---

## Usage

### React component

```tsx
'use client'; // Next.js App Router: the viewer is client-only

import { TeamSyncViewer, type WebViewerInstance } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

export function ContractViewer({ url }: { url: string }) {
  return (
    <div style={{ height: '80vh' }}>
      <TeamSyncViewer
        fileUrl={url}
        fileName="contract.pdf"
        assets={{ workerSrc: '/pdfjs/pdf.worker.min.mjs', cMapUrl: '/pdfjs/cmaps/' }}
        currentUser={{ id: 'u-42', name: 'Jane Doe' }}
        initialScale="fit-width"
        watermark={{ text: 'CONFIDENTIAL', mode: 'tiled', opacity: 0.08 }}
        onReady={(instance: WebViewerInstance) => console.log('ready', instance)}
        onDocumentLoadError={(error, retry) => {
          // e.g. mint a fresh presigned URL and retry
          retry(/* newUrl */);
        }}
      />
    </div>
  );
}
```

In Next.js, load it with `next/dynamic(() => import('./ContractViewer'), { ssr: false })` or keep
it inside a client component — the package itself never touches `window` at import time.

### Imperative API

```ts
import { createWebViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

const instance = await createWebViewer(
  { initialDoc: '/sample.pdf', fileName: 'sample.pdf', permissions: { canRedact: true } },
  document.getElementById('viewer-container')!
);

instance.on('documentLoaded', ({ numPages }) => console.log(numPages, 'pages'));
const pdfBytes = await instance.getFileData(); // annotated / redacted / watermarked Uint8Array
instance.destroy(); // unmounts and releases every listener
```

`WebViewer()` remains available as a deprecated alias of `createWebViewer()`.

---

## API overview

### `<TeamSyncViewer>` props / `WebViewerOptions`

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `fileUrl` (`initialDoc`) | `string` | — | URL of the PDF. Fetched by pdf.js (CORS + Range supported). |
| `fileName` | `string` | `annotated_document.pdf` | Name used for downloads. |
| `assets` | `PdfAssetPaths` | — | Worker / CMap / font / wasm locations (or call `configurePdfAssets`). |
| `withCredentials` | `boolean` | `false` | Send cookies with the document request. |
| `initialScale` | `number \| 'fit-width' \| 'fit-page'` | `1` | Initial zoom. |
| `initialPage` | `number` | `1` | 1-based page to open. |
| `readOnly` | `boolean` | `false` | Disables all annotation / redaction editing. |
| `permissions` | `SDKPermissions` | all `true` | `canAddAnnotations`, `canEditAnnotations`, `canDeleteAnnotations`, `canRedact`. |
| `currentUser` | `{ id, name }` | — | Author of annotations created in this viewer. |
| `watermark` | `WatermarkOptions` | — | `{ text, mode: 'single' \| 'tiled', size, opacity, color }`. |
| `redactions`, `regexRedactions` | `Redaction[]`, `RegExp[]` | `[]` | Pre-set and pattern-driven redactions. |
| `toolbar`, `sidebars`, `leftPanelOpen` | `boolean` | `true` | Chrome toggles. |
| `autoFocus` | `boolean` | `false` | Focus the viewer on mount (keyboard shortcuts). |
| `plugins` | `ViewerPlugin[]` | `[]` | Extension plugins. |

Callbacks: `onReady(instance)`, `onDocumentLoaded({ url, numPages })`,
`onDocumentLoadError(error, retry(newUrl?), { url, passwordRequired })`, `onFirstPageRendered`,
`onPasswordRequired`, `onPageChange(page, numPages)`, `onAnnotationsChange(annotations)`.

### `WebViewerInstance`

- `on(type, listener)` / `off` — typed events: `documentLoaded`, `documentLoadError`,
  `firstPageRendered`, `pageChanged`, `annotationsChanged`, `toolChanged`, `destroy`.
- `loadDocument(url)` — load or reload (resolves on load, rejects on error).
- `getFileData({ explicitAnnotations? })` — export the document as `Uint8Array`.
- `getAnnotations()`, `getCurrentPage()`, `getPageCount()`, `getPdfDocument()`.
- `destroy()` — unmount (imperative API) and release every listener.
- `UI.*` / `Core.*` — legacy facades (`UI.openElements`, `UI.fitWidth`,
  `Core.annotationManager.exportAnnotations()`, `Core.documentViewer.getDocument().getFileData()`).

Full reference: [docs/wiki/API-Reference-&-Options.md](docs/wiki/API-Reference-&-Options.md).

---

## Documentation

- [Getting Started](docs/wiki/Getting-Started.md) · [API Reference & Options](docs/wiki/API-Reference-&-Options.md)
- [Annotations & Markup](docs/wiki/Annotations-&-Markup-Guide.md) · [Redactions & PII Sanitization](docs/wiki/Redactions-&-PII-Sanitization.md)
- [Forensic Watermarking](docs/wiki/Forensic-Watermarking.md) · [Plugin Architecture](docs/wiki/Plugin-Architecture.md)
- [Changelog](CHANGELOG.md)

---

## Development

```bash
git clone https://github.com/angelbot-ai/TeamSync-PDF-Viewer.git
cd TeamSync-PDF-Viewer
npm install
npm run dev          # demo application at http://localhost:5173
npm test             # unit tests (vitest)
npm run build        # library -> dist/
npm run verify:package   # publint + arethetypeswrong + artifact guards
npm run build:app    # demo / iframe package build (Vercel)
```

Layout:

```
src/
├── index.ts              # public entry (side-effect free)
├── core/                 # createWebViewer, WebViewerInstance, event bus, pdf.js assets, export
├── components/           # TeamSyncViewer + internal UI (DocumentViewer, Header, sidebars, modals)
├── annotations/          # annotation data model
├── hooks/, utils/        # search, shortcuts, rotation helpers, regex redaction
├── plugins/              # plugin interfaces
└── demo/                 # demo & iframe-package bootstrap (not published)
```

### Iframe package (script-tag hosts)

`npm run build:app` produces a self-contained viewer; `public/webviewer.js` wraps it in an iframe
with a `postMessage` bridge and exposes a `WebViewer(options, element)` function for non-React hosts.

---

## TypeScript notes

Declarations ship in `dist/src/`. They resolve under `moduleResolution: "bundler"` (Next.js, Vite,
webpack) and `node10`; `node16`/`nodenext` resolution is not supported yet because the emitted
declarations use extension-less relative imports.

## License

[CPAL-1.0](LICENSE) — Copyright © 2026 AngelBot Ai Pvt Ltd.
