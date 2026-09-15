# 📄 Viewing Microsoft Office Documents (Word, PowerPoint, Excel)

Learn how to open, view, annotate, and search Microsoft Office documents directly inside **TeamSync PDF Viewer**.

---

## 🎯 Supported File Formats

| Category | File Extensions | MIME Types |
| :--- | :--- | :--- |
| **Microsoft Word** | `.docx`, `.doc` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword` |
| **Microsoft PowerPoint** | `.pptx`, `.ppt` | `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint` |
| **Microsoft Excel** | `.xlsx`, `.xls` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel` |

---

## 🏗️ Architecture & How It Works

Rather than using lossy client-side HTML parsers that strip fonts, vector shapes, headers, footers, and charts, TeamSync PDF Viewer uses a **high-fidelity conversion pipeline**:

```
[User opens .docx, .pptx, .xlsx]
         │
         ▼
[TeamSync PDF Viewer] ──(Checks In-Browser Cache)──► [Cached? Instant Render]
         │
         ▼ (Cache Miss)
[Secure Auth Gateway] ──(Validates Authorization Token)──► [401 if invalid]
         │
         ▼ (Token Valid)
[Headless LibreOffice + MS Fonts (Aptos, Calibri, Arial)]
         │
         ▼ (Converts to PDF/A Vector Stream in 200-500ms)
[TeamSync PDF Viewer Canvas] ──► [Full Text Search, Selection, Annotations & Print]
```

### Key Highlights
- **100% Native Fidelity**: Uses provisioned Microsoft TrueType fonts (`Aptos`, `Calibri`, `Cambria`, `Arial`, `Times New Roman`) to ensure exact font metrics and zero line-wrapping drift.
- **Full Viewer Capabilities**: Text selection, copy, full-text search, annotations (highlights, ink, notes, signatures), responsive auto-fit, and vector printing work out of the box.
- **Zero Third-Party Calls**: 100% self-hosted on your private infrastructure. No external cloud APIs, no Microsoft Graph, no Google Drive, no telemetry.
- **Multi-Tier Caching**: Converted document buffers are cached in browser memory, enabling sub-50ms instant reload on subsequent opens.

---

## 💻 Client-Side Setup

Pass the `officeConverter` configuration prop to `<TeamSyncViewer>`:

### 1. Basic Setup with Authorization Token
```tsx
import { TeamSyncViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

export function DocumentViewer() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <TeamSyncViewer
        fileUrl="https://internal-storage.company.com/reports/financial_q3.xlsx"
        officeConverter={{
          endpoint: 'https://converter.company.com/convert',
          authToken: 'your-secure-secret-token', // Automatically sent as 'Authorization: Bearer ...'
          cache: 'memory', // 'memory' | 'session' | 'none'
        }}
      />
    </div>
  );
}
```

### 2. Dynamic or Rotating Session Tokens (JWT / SSO)
If your application uses session tokens that rotate (e.g. Supabase, Auth0, Clerk, NextAuth):

```tsx
<TeamSyncViewer
  fileUrl="/contracts/services-agreement.docx"
  officeConverter={{
    endpoint: 'https://converter.company.com/convert',
    authToken: async () => {
      const session = await auth.getSession();
      return session.accessToken;
    },
  }}
/>
```

### 3. Conversion Lifecycle Events
You can hook into conversion lifecycle events to show custom toast notifications or telemetry:

```tsx
<TeamSyncViewer
  fileUrl="slides.pptx"
  officeConverter={{
    endpoint: 'https://converter.company.com/convert',
    authToken: 'secret-token',
  }}
  onOfficeConverting={({ fileType, fileName }) => {
    console.log(`Converting ${fileType} document: ${fileName}`);
  }}
  onOfficeConverted={({ fileType, fromCache }) => {
    console.log(`Document ready! Loaded from cache: ${fromCache}`);
  }}
  onOfficeConversionError={({ fileType, error }) => {
    console.error(`Failed to convert ${fileType}:`, error);
  }}
/>
```

---

## 🐳 Self-Hosted Conversion Backend Setup

The conversion backend is maintained in the dedicated private repository:
**[TeamSync-Office-Converter](https://github.com/angelbot-ai/TeamSync-Office-Converter)**

### Quick Start with Docker Compose

1. **Clone the private repository**:
   ```bash
   git clone https://github.com/angelbot-ai/TeamSync-Office-Converter.git
   cd TeamSync-Office-Converter
   ```

2. **Set your authorization token**:
   ```bash
   export AUTH_TOKEN="your-secure-secret-token"
   ```

3. **Start the service**:
   ```bash
   docker compose up -d
   ```

4. **Verify Health Endpoint**:
   ```bash
   curl http://localhost:3001/health
   # {"status":"ok","authEnforced":true}
   ```

5. **Test Conversion via cURL**:
   ```bash
   curl -X POST http://localhost:3001/convert \
     -H "Authorization: Bearer your-secure-secret-token" \
     -F "files=@document.docx" \
     --output document.pdf
   ```

---

## 🔒 Security & Air-Gapped Environments

- **Defense-in-Depth Architecture**: The internal LibreOffice engine container has **no public ports**. Only the `auth-gateway` container is exposed on port `3001`, ensuring every incoming request is authenticated.
- **Air-Gapped Operation**: The service operates with zero outbound internet access. For environments with proprietary corporate fonts, mount your TTF/OTF files into the container via:
  ```yaml
  volumes:
    - /path/to/corporate/fonts:/usr/share/fonts/truetype/custom:ro
  ```
- **File Upload Protection**: The file picker in `<TeamSyncViewer>` automatically accepts `.docx`, `.doc`, `.pptx`, `.ppt`, `.xlsx`, and `.xls` files directly from disk.
