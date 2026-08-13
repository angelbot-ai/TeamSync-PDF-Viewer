# ⚙️ API Reference & Options Guide

Complete reference for all options, parameters, and interfaces available in **TeamSync PDF Viewer SDK**.

---

## 🛠️ `WebViewerOptions`

Passed into `WebViewer(options, containerElement)`:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialDoc` | `string` | `undefined` | URL or relative path of the PDF document to open. |
| `initialScale` | `number` | `1.0` | Initial zoom scale factor (`1.0` = 100% natural size). |
| `enableAnnotations` | `boolean` | `true` | Enables or disables annotation drawing toolbar. |
| `enableRedactions` | `boolean` | `true` | Enables binary vector redaction capabilities. |
| `permissions` | `SDKPermissions` | `{}` | Fine-grained permission controls. |
| `watermark` | `WatermarkOptions` | `undefined` | Dynamic forensic watermark configuration. |
| `plugins` | `ViewerPlugin[]` | `[]` | Extension plugin array. |
| `regexRedactions` | `RegExp[]` | `[]` | Automated PII scanning patterns. |

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

Methods returned by `WebViewer(...)`:

- **`instance.Core.documentViewer.getDocument().getFileData()`**: Exports annotated/redacted PDF byte array (`Uint8Array`).
- **`instance.Core.annotationManager.getAnnotations()`**: Returns list of active annotations.
- **`instance.Core.annotationManager.addAnnotation(ann)`**: Adds a new annotation object.
