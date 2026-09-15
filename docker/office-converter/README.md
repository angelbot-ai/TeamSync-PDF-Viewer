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

## Quick Start (Docker Compose with Auth Gateway)

1. Set your secure authorization token in your environment or `.env`:
```bash
export AUTH_TOKEN="your-secure-secret-token-here"
```

2. Start the services (internal conversion engine + auth gateway):
```bash
cd docker/office-converter
docker compose up -d
```

3. Verify the public health endpoint (returns 200 without auth):
```bash
curl http://localhost:3001/health
```

4. Test conversion with your authorization token:
```bash
# Returns 401 Unauthorized without token:
curl -I -X POST http://localhost:3001/convert

# Successfully converts document with Bearer token:
curl -X POST http://localhost:3001/convert \
  -H "Authorization: Bearer your-secure-secret-token-here" \
  -F "files=@sample.docx" \
  --output sample.pdf
```

---

## Configuring TeamSync PDF Viewer with Authorization Token

Pass `authToken` directly to `officeConverter`:

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
          endpoint: 'http://localhost:3001/convert',
          authToken: 'your-secure-secret-token-here', // 👈 Automatically sent as 'Authorization: Bearer ...'
          cache: 'memory', // Sub-50ms repeat loads
        }}
      />
    </div>
  );
}
```

### Dynamic / Async Auth Token (e.g. Session JWT)
If your authorization token changes or expires (e.g. Supabase, Auth0, Clerk, NextAuth):

```tsx
<TeamSyncViewer
  fileUrl="/contracts/agreement.docx"
  officeConverter={{
    endpoint: 'https://converter.company.local/convert',
    authToken: async () => await getFreshUserToken(),
  }}
/>
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

### Custom On-Premise Converter Hook
You can also supply your own converter function targeting an internal company microservice:

```tsx
<TeamSyncViewer
  fileUrl="spreadsheet.xlsx"
  officeConverter={{
    convert: async (fileOrUrl, fileType, options) => {
      const response = await fetch('/api/internal-converter/convert', {
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

## Zero Third-Party Calls & Air-Gapped Security

This microservice is strictly **100% self-hosted** and engineered for sensitive enterprise, financial, legal, and air-gapped environments:
- **No Third-Party APIs**: Zero external cloud calls, no telemetry, and no data leaves your network.
- **Air-Gapped Operation**: All conversion engines (LibreOffice daemon) and fonts are bundled inside the container image or mounted via local volumes.
- **Network Isolation**: The service can run in an internal Docker network (`internal: true`) with outbound internet connectivity completely severed. Documents are processed 100% locally on CPU in memory.

## Production Deployment

This container is stateless and horizontal-scaling friendly:
- **AWS ECS / Fargate**: Deploy behind an Application Load Balancer.
- **Google Cloud Run**: Minimum 1GB RAM, concurrency 10-20.
- **Kubernetes / Helm**: Standard Deployment with Horizontal Pod Autoscaler based on CPU usage.
