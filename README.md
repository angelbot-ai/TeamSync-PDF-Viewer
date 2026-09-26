# TeamSync PDF Viewer SDK

<div align="center">

![TeamSync PDF Viewer UI](https://raw.githubusercontent.com/angelbot-ai/TeamSync-PDF-Viewer/main/docs/images/viewer_ui.png)

### **100% Open Source. 100% Client-Side. Enterprise SDK.**

[![License: CPAL-1.0](https://img.shields.io/badge/License-CPAL--1.0-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-pdfviewer.teamsync.com-000000.svg)](https://pdfviewer.teamsync.com/)
[![NPM Version](https://img.shields.io/badge/npm-teamsync--pdf--viewer-blue.svg)](https://www.npmjs.com/package/teamsync-pdf-viewer)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8.2-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)

*No paywalls. No vendor lock-in. No server dependencies.*  
Try the **[Interactive Live Demo](https://pdfviewer.teamsync.com/)** or integrate the high-performance PDF Viewer SDK directly into your React applications.

</div>

---

## 🚀 Why TeamSync PDF Viewer?

Traditional commercial PDF viewers force developers into expensive per-domain licenses, opaque sales calls, and heavy server-side processing dependencies. **TeamSync PDF Viewer** is built from the ground up to solve these pain points.

- 💰 **Zero-Cost, Transparent Licensing**: Uncapped usage, no per-server fees, and no commercial paywalls. 100% free and open-source under CPAL 1.0.
- ⚡ **100% Client-Side PDF Processing**: Documents never leave the browser sandbox. Process, redact, and render PDFs entirely on the client. 
- 🔌 **Universal WebViewer API**: Clean, intuitive `WebViewer({...})` API interface that makes integrating into your web applications effortless.
- 🎨 **Headless & Customizable**: Built for modern React 19 SPA lifecycles. No bloated iFrames to fight—customize toolbars, sidebars, context menus, and controls natively.

---

## 📦 Installation via NPM

Install the package into your React / TypeScript project:

```bash
# Using npm
npm install teamsync-pdf-viewer

# Using yarn
yarn add teamsync-pdf-viewer

# Using pnpm
pnpm add teamsync-pdf-viewer
```

### Installing from GitHub Packages (Alternative)

If installing from GitHub Packages registry:

1. Create or update your `.npmrc` file:
   ```ini
   @angelbot-ai:registry=https://npm.pkg.github.com
   ```
2. Install via npm:
   ```bash
   npm install teamsync-pdf-viewer
   ```

---

## 📖 Official Documentation & Wiki

Explore detailed SDK guides, parameter options, code snippets, and architecture deep dives:

- 🏠 **[Wiki Home](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Home)**: Main documentation index & overview.
- 🚀 **[Getting Started Guide](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Getting-Started)**: Installation, CDN, and framework setups.
- ⚙️ **[API Reference & Options](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/API-Reference-&-Options)**: Complete parameter list for `WebViewerOptions` & `SDKPermissions`.
- 📝 **[Interactive Forms & Multi-Role Signatures](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Interactive-Forms-&-Multi-Role-Signatures)**: PDF form designer, multi-role template assignment, signature sticky index flags & SDK.
- 🎨 **[Annotations & Markup Guide](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Annotations-&-Markup-Guide)**: Freehand drawing, vector shapes, callouts & links.
- 🛡️ **[Redactions & PII Sanitization Guide](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Redactions-&-PII-Sanitization)**: Binary redactions, regex PII scanning & discard options.
- 💧 **[Forensic Watermarking Guide](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Forensic-Watermarking)**: Dynamic single and tiled watermark setup.
- 🔌 **[Plugin Architecture Guide](https://github.com/angelbot-ai/TeamSync-PDF-Viewer/wiki/Plugin-Architecture)**: Writing custom extension plugins.

---

## ✨ Uncompromised Feature Set

Everything you need to build collaborative, secure document workflows.

### 📝 Interactive PDF Forms & Multi-Role Signatures (v2.0)
- **Visual Forms Designer ("Forms" Tab)**: Dedicated builder tab to design interactive forms with drag-to-create bounding boxes, 8 interactive resize handles, drag-to-move, and keyboard shortcuts.
- **Comprehensive Form Field Controls**: Textbox, Text Area, Date & Time Picker (calendar/clock modes), Multi-Choice Checklist, Single-Select Dropdown, and Radio Groups.
- **Multi-Role Form Templates**: Decoupled template roles (`FormRole`) such as `applicant`, `tenant`, `landlord`, or `reviewer`. Design reusable form templates without hardcoding user IDs.
- **Host Application User Integration**: Pass the logged-in user profile (`ViewerUser`) containing `id`, `name`, `email`, and `role`. Setting the user automatically activates their role in the form session.
- **Signature Sticky / Index Flags**: Visual sticky index flags docked along the viewport edge indicate pending signatures for the current user's role. Visible on Page 1 even when signature sections reside on Page 2 or later, with 1-click jump & sign.
- **Audit-Grade Signatures**: Electronic signatures (canvas drawing, typed handwriting, image upload) and digital certificate signatures (cryptographic SHA-256 seal) automatically recording signer name, email, role, and timestamp.
- **Interactive Form Filler ("View" Tab)**: Embedded live inputs positioned over PDF pages at exact coordinates, with sequential filling flow, per-role validation, JSON export, and native PDF AcroForm baking.

### 🎨 Smart Markup & Annotations
- **Full Drawing Toolkit**: Freehand ink (`brush`), highlighters, geometric shapes (rectangles, ellipses), arrows, and lines.
- **Notes & Callouts**: Sticky notes, callout text boxes with directional arrows, and text annotations.
- **Interactive Hyperlinks**: Create internal page-jump links (`#page=N`) or external web URL links directly on document selections.

### 🛡️ Secure Redaction
- **Binary-Level Data Obliteration**: We don't just place black boxes over text—redactions are permanently rasterized and burned into the underlying PDF vector structure.
- **Text Layer Sanitization**: Redacted text is automatically stripped from the DOM `textLayer` and PDF content streams, preventing copy/paste extraction and search indexing.
- **Automatic Regex Redactions**: Programmatically locate and redact sensitive PII in a single click.
- **Discard Unapplied Redactions**: Easily discard individual pending redactions or bulk-discard all unapplied redaction marks before committing.

### 📐 Dynamic Layout & Viewport Controls
- **Fit to Width & Fit to Page**: Container-aware dynamic scaling calculations for responsive reading on any screen size.
- **Synchronized Page Rotation**: 360° page rotation with real-time vector coordinate transforms so annotations rotate seamlessly with document content.

### 🔍 High-DPI Canvas Rendering & Search
- **Retina 60 FPS Zoom & Pan**: High-DPI `devicePixelRatio` scaling eliminates blurred text. Micro-debounced rendering enables buttery-smooth 60 FPS trackpad pinching and 360° mouse drag panning.
- **Contextual Document Search**: Instant client-side text search with real-time match highlighting, result jumping, and match counting.

### 💧 Dynamic Forensic Watermarking
- Programmatic, non-destructive watermarks rendered on the fly (single centered or full-page tiled) with customizable text, color, opacity, font size, and rotation.

---

## 💻 Developer SDK Usage

### Standard WebViewer Initialization

Drop the SDK into any container element with a single function call:

```typescript
import { WebViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

WebViewer({
  initialDoc: '/sample.pdf',
  initialScale: 1.0, // 100% natural size
  enableAnnotations: true,
  permissions: {
    canRedact: true,
    canAddAnnotations: true
  },
  watermark: {
    text: 'CONFIDENTIAL',
    mode: 'single',
    size: 48,
    opacity: 0.1,
    color: '#dc2626'
  }
}, document.getElementById('viewer-container')).then((instance) => {
  console.log('TeamSync PDF Viewer is ready!', instance);
  
  // Programmatic Viewport Controls
  instance.UI.fitWidth();
  instance.UI.fitPage();

  // Export annotated PDF buffer
  instance.Core.documentViewer.getDocument().getFileData().then((pdfBytes) => {
    console.log('Exported PDF byte length:', pdfBytes.length);
  });
});
```

### Native React Component Usage

For native React integration, use the `<DocumentViewer />` component:

```tsx
import { DocumentViewer } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DocumentViewer
        initialDoc="/contract.pdf"
        scale={1.0}
        enableAnnotations={true}
        permissions={{ canRedact: true, canAddAnnotations: true }}
      />
    </div>
  );
}
```

### Multi-Role Forms & Electronic Signatures (v2.0)

For multi-party form workflows, role assignment, and signature collection:

```tsx
import { TeamSyncViewer, WebViewerInstance } from 'teamsync-pdf-viewer';
import 'teamsync-pdf-viewer/style.css';

function ContractSigningPortal() {
  const currentUser = {
    id: 'usr_98124',
    name: 'Robert Davis',
    email: 'robert@domain.com',
    role: 'tenant', // Automatically activates 'tenant' role & signature flags
  };

  const formRoles = [
    { id: 'tenant', name: 'Tenant', color: '#2563eb' },
    { id: 'landlord', name: 'Landlord', color: '#10b981' },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <TeamSyncViewer
        initialDoc="/lease-agreement.pdf"
        currentUser={currentUser}
        formRoles={formRoles}
        formOptions={{
          allowRoleSwitching: false,       // Locked to respondent's assigned role
          otherRoleFieldsMode: 'view-only', // Read-only for landlord fields
          showSignatureFlags: true,         // Display side sticky index flags
        }}
        onViewerReady={(instance: WebViewerInstance) => {
          // Programmatic Form SDK
          console.log('Active Role:', instance.getCurrentRole());
          console.log('Form Fields:', instance.getFormFields());
          
          // Validate current role's required fields
          const result = instance.validateForm();
          if (!result.valid) console.warn('Incomplete:', result.errors);
        }}
      />
    </div>
  );
}
```

---

## 🛠️ Local Development Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/angelbot-ai/TeamSync-PDF-Viewer.git
cd TeamSync-PDF-Viewer
npm install
```

### 2. Launch Dev Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser to launch the live SDK viewer.

---

## 🔌 Extensible Plugin Architecture

TeamSync PDF Viewer features a decoupled **Plugin Architecture**. Core PDF rendering, smart annotations, redaction engines, and search remain lightweight and modular in the main engine, while enterprise extensions plug in as independent modules.

```
┌─────────────────────────────────────────────────────────┐
│              TeamSync PDF Viewer Core                   │
│   (Page Rendering, Annotations, Redactions, Search)     │
└───────────────────────────┬─────────────────────────────┘
                            │ Plugins Registry API
┌───────────────────────────▼─────────────────────────────┐
│                   Custom Extension                      │
│      (Custom Modals, Action Buttons, Export Hooks)      │
└─────────────────────────────────────────────────────────┘
```

```typescript
import { WebViewer } from 'teamsync-pdf-viewer';
import { myCustomPlugin } from './myCustomPlugin';

WebViewer({
  initialDoc: '/sample.pdf',
  plugins: [
    myCustomPlugin({ enableFeature: true })
  ]
}, document.getElementById('viewer-container'));
```

---

## 🏛️ Architecture & Tech Stack

- **Core Engine**: HTML5, TypeScript, WebAssembly (PDF.js + pdf-lib)
- **UI & State**: React 19, Lucide Icons, Pure CSS Modules
- **Build System**: Vite 8 & Oxlint (Sub-500ms tree-shakable builds)

```
TeamSync-PDF-Viewer/
├── src/
│   ├── components/       # Native React UI (Header, DocumentViewer, Forms, Modals)
│   ├── forms/            # Interactive Forms Engine (FormManager, Roles, AcroForm, Signatures)
│   ├── office/           # Native Microsoft Office document viewing and conversion
│   ├── annotations/      # Annotation manager, vector rendering, and XFDF engine
│   ├── hooks/            # Search & Keyboard shortcut hooks
│   ├── utils/            # Redaction algorithms, rotation transforms & vector helpers
│   ├── plugins/          # Plugin API interfaces & registry
│   ├── index.ts          # Main SDK package exports
│   ├── main.tsx          # WebViewer SDK entry point & public API bridge
│   └── App.tsx           # Demo Application Shell
├── public/               # Static PDF assets & PDF.js workers
└── docs/images/          # High-res UI documentation screenshots
```

---

## 📄 License

Distributed under the **CPAL 1.0 (Common Public Attribution License)**.  
100% Free and Open Source for personal and commercial usage.

---

<div align="center">
  <b>AngelBot AI • TeamSync • </b> <a href="https://www.teamsync.com" target="_blank" rel="noopener noreferrer">https://www.teamsync.com</a>
</div>

<div align="center">
  <b>TeamSync PDF Viewer Engine</b> • Engineered with ❤️ for the Open Web.
</div>
