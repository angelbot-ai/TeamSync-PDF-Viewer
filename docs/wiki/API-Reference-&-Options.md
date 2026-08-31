# ⚙️ API Reference & Options Guide

Complete reference for all options, parameters, and interfaces available in **TeamSync PDF Viewer SDK**.

---

## 🛠️ `WebViewerOptions` / `<TeamSyncViewer>` props

Passed into `createWebViewer(options, containerElement)`; every option is also a prop of `<TeamSyncViewer>`:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialDoc` / `fileUrl` | `string` | `undefined` | URL of the PDF document to open (fetched by pdf.js; CORS + HTTP Range supported). |
| `fileName` | `string` | `annotated_document.pdf` | Name used for downloads. |
| `assets` | `PdfAssetPaths` | `undefined` | `{ workerSrc, cMapUrl, standardFontDataUrl, wasmUrl, iccUrl }` — see `configurePdfAssets`. |
| `withCredentials` | `boolean` | `false` | Send cookies with the document request. |
| `initialScale` | `number \| 'fit-width' \| 'fit-page'` | `1.0` | Initial zoom. |
| `initialPage` | `number` | `1` | 1-based page to scroll to after load. |
| `readOnly` | `boolean` | `false` | Disables every annotation/redaction edit. |
| `enableAnnotations` | `boolean` | `true` | Enables or disables the annotation toolbar. |
| `enableRedactions` | `boolean` | `true` | Enables redaction tools. |
| `permissions` | `SDKPermissions` | `{}` | Fine-grained permission controls. |
| `currentUser` | `{ id: string; name: string }` | `undefined` | Author attached to annotations created in the viewer. |
| `watermark` | `WatermarkOptions` | `undefined` | Dynamic forensic watermark configuration. |
| `plugins` | `ViewerPlugin[]` | `[]` | Extension plugin array. |
| `redactions` | `Redaction[]` | `[]` | Pre-set redaction rectangles. |
| `regexRedactions` | `RegExp[]` | `[]` | Automated PII scanning patterns. |
| `toolbar` / `sidebars` / `leftPanelOpen` | `boolean` | `true` | Chrome toggles. |
| `autoFocus` | `boolean` | `false` | Focus the viewer on mount so keyboard shortcuts apply immediately. |

`<TeamSyncViewer>` additionally accepts `className`, `style` and the callbacks `onReady(instance)`,
`onDocumentLoaded({ url, numPages })`, `onDocumentLoadError(error, retry, { url, passwordRequired })`,
`onFirstPageRendered({ url, pageNumber })`, `onPasswordRequired({ url })`, `onPageChange(page, numPages)`
and `onAnnotationsChange(annotations)`.

---

## 🔒 `SDKPermissions` Interface

```typescript
export interface SDKPermissions {
  canAddAnnotations?: boolean;
  canEditAnnotations?: boolean;
  canDeleteAnnotations?: boolean;
  canRedact?: boolean;
}
```

---

## 🏛️ `WebViewerInstance` Methods

Returned by `createWebViewer(...)` and exposed through `<TeamSyncViewer ref>` / `onReady`:

- **`instance.on(type, listener)` / `instance.off(type, listener)`**: typed events — `documentLoaded`, `documentLoadError`, `firstPageRendered`, `pageChanged`, `annotationsChanged`, `toolChanged`, `destroy`.
- **`instance.loadDocument(url)`**: loads or reloads a document; resolves with `{ url, numPages }`.
- **`instance.getFileData({ explicitAnnotations? })`**: exports the annotated/redacted/watermarked PDF as `Uint8Array` from the bytes of the loaded document (no re-download).
- **`instance.getAnnotations()`**: returns the live annotation list.
- **`instance.getCurrentPage()` / `instance.getPageCount()` / `instance.getPdfDocument()`**.
- **`instance.destroy()`**: unmounts the viewer created by `createWebViewer` and releases every listener.
- Legacy facades kept for drop-in compatibility: `instance.UI.openElements([...])`, `closeElements`, `setActiveLeftPanel`, `fitWidth`, `fitPage`, `setToolMode`; `instance.Core.annotationManager.exportAnnotations()` (JSON), `getAnnotationsList()`; `instance.Core.documentViewer.getDocument().getFileData()`, `addEventListener(event, cb)`.
