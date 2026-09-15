# TeamSync Office Document Conversion Microservice

This directory provides a ready-to-run containerized microservice enabling **TeamSync PDF Viewer** to render Microsoft Word (`.docx`, `.doc`), PowerPoint (`.pptx`, `.ppt`), and Excel (`.xlsx`, `.xls`) documents with **native Microsoft Office fidelity**.

---

## Why Headless Backend Conversion?

Pure client-side JavaScript renderers (like `mammoth.js`, `docx-preview`, `SheetJS`, and `pptx2html`) strip away complex formatting, drop header/footer page numbers, fail to render floating vector shapes, and cannot paginate spreadsheets or slides.

By converting Office documents into standardized PDF/A streams via headless LibreOffice with complete Microsoft TrueType font packages:
- **100% Native Layout & Typography**: Uses exact Microsoft core fonts (`Arial`, `Times New Roman`, `Calibri`, `Segoe UI`, `Aptos`).
- **Zero Viewer Bundle Bloat**: No 100MB WASM downloads in the user's browser.
- **Full Viewer Capabilities**: Annotations (highlights, ink, sticky notes, redactions), text search, text selection, slide thumbnails, and vector printing work out of the box.

---

## Quick Start (Docker Compose)

Run the conversion service locally on port `3001`:

```bash
cd docker/office-converter
docker compose up -d
```

Verify the service is running:

```bash
curl -I http://localhost:3001/health
```

---

## Configuring TeamSync PDF Viewer

Pass the `officeConverter` prop to `<TeamSyncViewer>` or into `createWebViewer()`:

### React Component Usage
```tsx
import { TeamSyncViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

export function DocumentPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <TeamSyncViewer
        fileUrl="https://example.com/documents/quarterly-review.pptx"
        officeConverter={{
          endpoint: 'http://localhost:3001/forms/libreoffice/convert',
          cache: 'memory', // Sub-50ms repeat loads
        }}
      />
    </div>
  );
}
```

### Custom Proxy or Serverless Function
If your web application has an authenticated API route (e.g. Next.js `/api/convert-office` or Express):

```tsx
<TeamSyncViewer
  fileUrl="/contracts/master-services-agreement.docx"
  officeConverter={{
    endpoint: '/api/convert-office',
    headers: async () => ({
      Authorization: `Bearer ${await getAuthToken()}`,
    }),
  }}
/>
```

### Custom Client Hook (e.g. Microsoft Graph API)
You can also supply your own converter function:

```tsx
<TeamSyncViewer
  fileUrl="spreadsheet.xlsx"
  officeConverter={{
    convert: async (fileOrUrl, fileType, options) => {
      const response = await fetch('/api/ms-graph/convert-to-pdf', {
        method: 'POST',
        body: JSON.stringify({ fileUrl: fileOrUrl }),
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.arrayBuffer();
    },
  }}
/>
```

---

## Production Deployment

This container is stateless and horizontal-scaling friendly:
- **AWS ECS / Fargate**: Deploy behind an Application Load Balancer.
- **Google Cloud Run**: Minimum 1GB RAM, concurrency 10-20.
- **Kubernetes / Helm**: Standard Deployment with Horizontal Pod Autoscaler based on CPU usage.
