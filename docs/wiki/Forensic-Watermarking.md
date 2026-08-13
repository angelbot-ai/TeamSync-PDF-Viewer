# 💧 Forensic Watermarking Guide

Configure dynamic, non-destructive watermarks rendered programmatically on the fly.

---

## ⚙️ `WatermarkOptions` Configuration

```typescript
WebViewer({
  initialDoc: '/document.pdf',
  watermark: {
    text: 'CONFIDENTIAL - FOR INTERNAL USE ONLY',
    mode: 'single', // 'single' centered or 'tiled' across entire page
    size: 48,
    opacity: 0.1,
    color: '#dc2626'
  }
}, container);
```
