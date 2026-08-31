# Changelog

All notable changes to `teamsync-pdf-viewer` are documented here.

## [1.1.0] — 2026-08-31

### Breaking
- The npm entry point is now **side-effect free**: importing the package no longer touches `window`,
  never auto-mounts a demo viewer into `#root`, and no longer installs the iframe `postMessage` bridge.
  Those behaviours live in the demo/iframe application build only (`src/demo/main.tsx`,
  `npm run build:app`, `public/webviewer.js`).
- `react`, `react-dom` and `pdfjs-dist` are **peer dependencies** (previously `react` was a hard
  dependency, which could install a second React copy).
- The pdf.js **worker is no longer inlined** as a `data:` URL. Hosts must serve
  `pdf.worker.min.mjs` (matching their installed `pdfjs-dist`) and call `configurePdfAssets({ workerSrc })`
  or pass `assets={{ workerSrc }}` to `<TeamSyncViewer>`. This shrinks the bundle from 5.3 MB to
  well under 1 MB and works under strict Content-Security-Policies.
- The UMD build was removed (`pdfjs-dist` v6 is ESM-only, so it never worked for real consumers).
  Script-tag users are served by the iframe package.
- `DocumentViewer`, `Header`, `Sidebar` and `PageRenderer` are no longer exported — they are
  internal components with unstable props. Use `<TeamSyncViewer>` / `createWebViewer()`.
- Library styles are scoped under `.tspdf-root`; the global `*`/`body` resets moved to the demo.

### Added
- `<TeamSyncViewer>` — an embeddable, container-sized React component with a small, typed prop
  surface (`fileUrl`, `readOnly`, `currentUser`, `assets`, `withCredentials`, `toolbar`, `sidebars`,
  `initialScale: 'fit-width' | 'fit-page'`, `onReady`, `onDocumentLoaded`, `onDocumentLoadError(error, retry)`,
  `onFirstPageRendered`, `onPasswordRequired`, `onPageChange`, `onAnnotationsChange`).
- `createWebViewer(options, element)` (the old `WebViewer()` remains as a deprecated alias) returning a
  `WebViewerInstance` with `destroy()`, `loadDocument(url)`, typed `on()/off()` events
  (`documentLoaded`, `documentLoadError`, `firstPageRendered`, `pageChanged`, `annotationsChanged`,
  `toolChanged`, `destroy`), `getFileData()`, `getAnnotations()` and the legacy `UI`/`Core` facades.
- Per-instance event bus: several viewers can be mounted on one page without cross-talk; keyboard
  shortcuts apply to the focused viewer only.
- `configurePdfAssets()` for worker / CMap / standard-font / wasm locations.
- Real TypeScript declarations (`dist/index.d.ts`), `teamsync-pdf-viewer/style.css`, `"use client"`
  banner for React Server Components bundlers, `sideEffects` metadata, source maps.
- CI workflow (lint, typecheck, unit tests, library + demo builds, `publint` + `arethetypeswrong`
  package guards) and a first vitest suite.

### Fixed
- `package.json` `types` condition ordering and the non-existent `dist/style.css` export.
- Export (`getFileData`) no longer issues a `HEAD` probe nor re-downloads the document; it uses the
  bytes of the already-loaded document, so presigned/expiring URLs work.
- Pages with an intrinsic `/Rotate` render correctly; UI rotation now composes on top of it
  (search highlights and redactions were previously misplaced on such pages).
- Hard-coded signer email removed from digital-signature placeholders (uses `currentUser.name`).
- Watermark text no longer defaults to `user@example.com - Confidential` in embedded usage.
- Loading errors (including password-protected documents) are surfaced instead of being logged only.
- Truncated `LICENSE` replaced with the full CPAL-1.0 text; stale docs and package name fixed.

## [1.0.4] — 2026-08-15
- Historical release (never published to npm; 1.0.3 is the last 1.0.x on the registry).
