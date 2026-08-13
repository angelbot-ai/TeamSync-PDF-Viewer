# 🛡️ Redactions & PII Sanitization Guide

**TeamSync PDF Viewer** provides military-grade binary vector redaction and DOM text layer sanitization.

---

## 🔒 Vector-Level Redaction Engine

Unlike primitive viewers that place black HTML boxes on top of canvas, TeamSync PDF Viewer permanently rasterizes redacted regions into the PDF vector stream and strips underlying text from the DOM.

---

## ⚡ Auto Regex PII Scanning

Pass custom regular expressions to automatically locate and redact sensitive PII (Aadhaar, SSN, Credit Cards, Dates of Birth):

```typescript
WebViewer({
  initialDoc: '/contract.pdf',
  regexRedactions: [
    /\d{4} \d{4}(?= \d{4})/g, // Aadhaar / SSN 8-digit mask
    /DOB: \d{2}\/\d{2}\/\d{4}/g // Date of Birth mask
  ]
}, container);
```

---

## 🗑️ Discarding Unapplied Redactions

Users can discard pending unapplied redactions at any time:
1. **Clicking the `X` Badge**: Every unapplied redaction box on the PDF page displays a red `X` badge to immediately remove it.
2. **"Discard Redactions" Toolbar Button**: Appears in the redactions toolbar when pending redactions exist.
3. **Confirmation Modal**: A secondary **Discard Redactions** button inside the "Apply Redactions" modal allows discarding marked areas.
