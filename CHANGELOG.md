# Changelog

All notable changes to `teamsync-pdf-viewer` are documented here.

## [1.3.5] — 2026-09-04

### Fixed
- **Annotations Before Document Canvas**: Fixed bug where the SVG annotation overlay and transient citation highlights rendered synchronously over a still-blank white container on initial load, virtualized scroll (pages 2+), and post-open fit re-renders. Annotations now wait until the underlying page canvas has finished rendering its pixels before becoming visible.
- **`hideAnnotationsUntilPageRendered` Option**: Added `hideAnnotationsUntilPageRendered?: boolean` (defaults to `true`) across `WebViewerOptions`, `TeamSyncViewerProps`, and `DocumentViewerProps`.
- **`pageRendered` Lifecycle Event**: Added `pageRendered: { url: string; pageNumber: number }` to `ViewerEventMap` and `onPageRendered` callback to `TeamSyncViewerProps` and `DocumentViewerProps`, giving consumers a lifecycle hook whenever any page finishes canvas rendering.
- **Capped Zoom Level to 800%**: Changed `MAX_SCALE = 8.0` (800%), updated zoom stepping and boundary checks, and updated toolbar preset dropdown to cap at 800%.

## [1.3.4] — 2026-09-04

### Fixed
- **Mobile & Android Canvas Clamping**: Expanded `isMobileOrTablet()` to comprehensively detect Android and mobile devices, capping max dimension to 2048px and pixel buffer to 4.2 MP (~16MB) to eliminate canvas crashes and blank pages on mobile devices.
- **Render Task Lifecycle & Race Condition Fix**: Scoped `currentPage` locally within `renderCanvas` so cancelling in-flight renders during rapid zoom clicks never accidentally destroys resources of a newly scheduled page proxy.
- **Graceful Context Allocation Fallback**: Added half-resolution fallback if `getContext('2d')` ever encounters device memory pressure, preventing invisible pages.
- **Rapid Click Selection Prevention**: Added `userSelect: none` on toolbar zoom buttons to eliminate browser text selection during rapid clicking.

## [1.3.3] — 2026-09-04

### Fixed
- **Initial Programmatic Fit Scroll Compensation**: Fixed view jump on initial fit where scaling from seed 1.0 to ~2.27 at `scrollTop = 0` triggered viewport center compensation and hid page 1's top. Added `calculateScrollCompensation` with programmatic fit bypass and top-of-document boundary guard.
- **Capped Canvas Output Scale**: Capped `outputScale = Math.min(window.devicePixelRatio || 1, 2)` in `PageRenderer` and `LeftSidebar`, reducing GPU canvas raster memory and repaint strain on 3x+ Retina and mobile displays by over 55% while preserving 2x sharpness.
- **Scroll Shaking & Up-Front Dimension Reservation**: Replaced asynchronous sequential dimension streaming with up-front dimension measurement and space pre-allocation (`estimatePageDimensions`). Full scroll container height and row tops are reserved on the first frame, eliminating layout recalculations and page shifting/shaking during scrolling.
- **Exported Layout & Zoom Utilities**: Exported `calculateScrollCompensation`, `estimatePageDimensions`, `computeRowLayout`, `DEFAULT_FALLBACK_DIMS`, and related types from the package root.

## [1.3.2] — 2026-09-04

### Fixed
- **Hardware-Bounded Canvas Texture Clamping**: Fixed crash and invisible content when zooming past 800% (up to 1000%) by clamping internal raster buffers to safe hardware limits (`MAX_CANVAS_DIM` = 4096 / 8192 px, `MAX_CANVAS_PIXELS` = 16.7 MP / ~64MB buffer) while keeping CSS layout full-sized for smooth, distortion-free GPU scaling.
- **In-Flight Render Task Cancellation**: Resolved UI freezing and crashes during rapid clicking of `+` / `-` zoom buttons by cancelling running PDF.js render tasks directly by reference and releasing completed/cancelled page resources (`page.cleanup()`).
- **Immediate GPU Texture Deallocation**: Zeroed offscreen `tempCanvas` dimensions immediately after raster blitting to return GPU backing texture memory to the system without waiting for garbage collection.
- **Zoom Gesture Debouncing**: Added 150ms debounce on zoom changes to allow existing textures to scale at 60fps via CSS transforms before triggering expensive PDF.js vector rasterization upon motion settling.
- **Eliminated False Cache Invalidation in `React.memo`**: Removed stale `scrollTop` / `scrollLeft` checks in `PageRenderer`, preventing re-rendering of all mounted pages on every scroll and zoom frame.
- **Scale-Aware Virtualization Window**: Virtualized document rows dynamically based on zoom scale, keeping mounted pages to a maximum of 3 at high zoom levels.
- **Intuitive Zoom Stepping Curves & Controls**: Implemented responsive stepping curves (+0.25 under 2x, +0.5 under 5x, +1.0 above 5x), capped max zoom at 1000% (`MAX_SCALE = 10.0`), and disabled `+` / `-` toolbar buttons at boundary limits. Exported `MIN_SCALE`, `MAX_SCALE`, `clampScale`, `calculateNextZoomIn`, and `calculateNextZoomOut`.

## [1.3.1] — 2026-09-04

### Fixed
- **Settings & Keyboard Shortcuts Customization**: Fixed settings search bar filtering across all shortcuts and general settings. Resolved shortcut recording and key normalization for US keyboard layouts (such as `Meta+Shift+=` and `Meta+Shift+-`), enabled `Escape` cancellation, and added a "Reset to Defaults" option.
- **Cross-Component Shortcut Synchronization**: Replaced local hook state with a shared reactive pub/sub store backed by `window.localStorage`, ensuring shortcut customizations sync immediately across all active viewer instances.
- **Viewer-Side Shortcut Execution**: Enabled full shortcut action handling in the viewer, adding support for `SEARCH` (`Meta+F`), `FILE_PICKER` (`Meta+O`), `COPY` (`Meta+C`), and `PASTE` (`Meta+V`) alongside existing rotation and undo/redo shortcuts. Added an "Open PDF..." action to the header menu and window-level shortcut handling.
- **Sidebar Search Bar**: Enabled immediate search on `Enter` keypress, immediate query and highlight clearing, auto-focus when opening the search tab, and corrected box-sizing to eliminate container overflow.

## [1.3.0] — 2026-09-04

### Added
- **Programmatic & Reactive Page Navigation**: Added `instance.goToPage(pageNumber, options?)` and `instance.setCurrentPage(pageNumber)` (also available via `instance.UI.setCurrentPageNumber` and `instance.Core.documentViewer.goToPage`). Added reactive navigation when `page` or `initialPage` props update on `<TeamSyncViewer>` or `<DocumentViewer>` while the viewer is already open, enabling citation jumping without reopening documents.
- **Exported Text Search Utilities**: Extracted standalone asynchronous search function `searchPdfText(pdfDoc, query, redactions?, onProgress?)` and exported `usePdfSearch`, `searchPdfText`, `SearchResult`, and `SearchBounds` from the library root. Added `instance.searchText(query)` to execute document searches programmatically.
- **Transient Citation Highlights Layer**: Added dedicated transient highlights system (`TransientHighlight`, `instance.setTransientHighlights`, `instance.getTransientHighlights`, `instance.addTransientHighlight`, `instance.clearTransientHighlights`, and `instance.highlightSnippet`). Highlights render on an isolated overlay layer with pulse animations and tooltips without polluting `AnnotationManager`, `getAnnotations()`, or XFDF exports.

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
