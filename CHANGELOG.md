# Changelog

All notable changes to `teamsync-pdf-viewer` are documented here.

## [1.2.1] — 2026-09-01

### Fixed
- **The stylesheet no longer restyles the host application.** `dist/style.css` bundles
  `pdfjs-dist/web/pdf_viewer.css`, ~900 selectors written for pdf.js's own standalone viewer —
  including bare generic class names such as `.sidebar`, `.dialog`, `.toggle-button`,
  `.closeButton` and `.messageBar`. Only this package's own rules were scoped under `.tspdf-root`;
  the pdf.js ones shipped globally. Because the stylesheet is injected at runtime it won every
  cascade tie, so a host with its own `.sidebar` had it silently restyled (wrong width, white
  background, `position: relative` + `inset-block-start`) as soon as the viewer module loaded —
  which happens on preference selection, before any PDF is opened.

  Every selector is now scoped at build time, after nesting is flattened. `:root`/`html`/`body`
  are re-targeted to `.tspdf-root` rather than prefixed, so the custom properties the viewer's
  descendants read still resolve. `npm run verify:package` fails the build if any selector is
  unscoped, or prefixed more than once (which would match nothing and break the viewer's own
  styling).

## [1.2.0] — 2026-08-31

### Added
- **`AnnotationManager`** (`instance.annotationManager`, also `instance.Core.annotationManager`):
  the canonical annotation list with undo/redo, granular `annotationChanged` events
  (`add` | `modify` | `delete`, with an `imported` flag), authorship stamping
  (`currentUser`), edit permissions (read-only viewer, read-only annotation, other authors —
  `permissions.canEditOthers`) and programmatic `addAnnotations` / `updateAnnotation` /
  `deleteAnnotations` / `getAnnotationById`.
- **Native XFDF**: `annotationManager.importAnnotations(xfdf)` and
  `exportAnnotations({ annotList?, useDisplayAuthor? })` (bare fragments per annotation, or a full
  document). Reads Acrobat/Apryse XFDF (square, circle, line/arrow, ink, highlight quads, freetext,
  callout, sticky note, stamp with image data, link) and keeps everything else as read-only
  `opaque` annotations that re-export verbatim; unknown attributes/children (e.g. Apryse
  `trn-custom-data`) are preserved across a round-trip. Stable UUID ids double as the XFDF `name`.
- **Page geometry module** (`createPageGeometry`, `rectToPdf`, `quadPointsToRects`, …): the single
  authority for base-page-space ↔ PDF-user-space conversion, mirroring pdf.js's viewport transform.
- **Print** (menu item enabled, `instance.print()`): the exported document is printed through the
  browser's PDF viewer in a hidden frame.
- `instance.on('annotationChanged', …)` typed event; `Annotation.author/authorId/createdAt/
  modifiedAt/readOnly/strokes/rects` fields; multi-stroke ink and multi-rect highlights render.

### Fixed
- Export geometry: annotations are baked exactly where they were drawn (any page size, CropBox
  offset or intrinsic /Rotate) — replaces the hard-coded `scale = 1.5` conversion.
- Mixed page sizes: layout, scrolling, hit-testing and fit-to-width/page now use per-page
  dimensions instead of page 1's.
- Annotation ids were timestamps (collision-prone); now `crypto.randomUUID()`.

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
