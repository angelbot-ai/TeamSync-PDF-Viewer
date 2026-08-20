# TeamSync PDF Viewer SDK
Open-source PDF SDK for React.

<div align="center">

![TeamSync PDF Viewer UI](https://raw.githubusercontent.com/angelbot-ai/TeamSync-PDF-Viewer/main/docs/images/viewer_ui.png)

Render, annotate, search, redact and export PDFs entirely in the browser.

[Live Demo] [Documentation] [npm] [GitHub]

✨ Annotations
🔐 Permanent redaction
🔎 PDF search
🕵️ PII detection
💧 Watermarking
⚛️ React 19
📦 TypeScript
🌐 Client-side

### **100% Open Source. 100% Client-Side. Enterprise PDF Engine.**

[![License: CPAL-1.0](https://img.shields.io/badge/License-CPAL--1.0-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-pdfviewer.teamsync.com-000000.svg)](https://pdfviewer.teamsync.com/)
[![NPM Version](https://img.shields.io/badge/npm-%40angelbot--ai%2Fteamsync--pdf--viewer-blue.svg)](https://www.npmjs.com/package/teamsync-pdf-viewer)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8.2-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)

*No paywalls. No vendor lock-in. No server dependencies.*  
Try the **[Interactive Live Demo](https://pdfviewer.teamsync.com/)** or integrate the high-performance PDF Viewer SDK into your React applications.

</div>

---

## 🚀 Why TeamSync PDF Viewer?

Traditional commercial PDF viewers force developers into expensive per-domain licenses, opaque sales calls, and heavy server-side processing dependencies. **TeamSync PDF Viewer** is built from the ground up to solve these pain points.

- 💰 **Zero-Cost, Transparent Licensing**: Uncapped usage, no per-server fees, and no commercial paywalls. 100% free and open-source under CPAL 1.0.
- ⚡ **100% Client-Side WebAssembly**: Documents never leave the browser sandbox. Process, redact, and render PDFs entirely.
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

- 🏠 **[Wiki Home](docs/wiki/Home.md)**: Main documentation index & overview.
- 🚀 **[Getting Started Guide](docs/wiki/Getting-Started.md)**: Installation, CDN, and framework setups.
- ⚙️ **[API Reference & Options](docs/wiki/API-Reference-&-Options.md)**: Complete parameter list for `WebViewerOptions` & `SDKPermissions`.
- 🎨 **[Annotations & Markup Guide](docs/wiki/Annotations-&-Markup-Guide.md)**: Freehand drawing, vector shapes, callouts & links.
- 🛡️ **[Redactions & PII Sanitization Guide](docs/wiki/Redactions-&-PII-Sanitization.md)**: Binary redactions, regex PII scanning & discard options.
- 💧 **[Forensic Watermarking Guide](docs/wiki/Forensic-Watermarking.md)**: Dynamic single and tiled watermark setup.
- 🔌 **[Plugin Architecture Guide](docs/wiki/Plugin-Architecture.md)**: Writing custom extension plugins.

---

## ✨ Uncompromised Feature Set

Everything you need to build collaborative, secure document workflows.

### 🎨 Smart Markup & Annotations
- **Full Drawing Toolkit**: Freehand ink (`brush`), highlighters, geometric shapes (rectangles, ellipses), arrows, and lines.
- **Notes & Callouts**: Sticky notes, callout text boxes with directional arrows, and text annotations.
- **Interactive Hyperlinks**: Create internal page-jump links (`#page=N`) or external web URL links directly on document selections.

### 🛡️ PDF Secure Redaction
- **Binary-Level Data Obliteration**: We don't just place black boxes over text—redactions are permanently rasterized and burned into the underlying PDF vector structure.
- **Text Layer Sanitization**: Redacted text is automatically stripped from the DOM `textLayer` and PDF content streams, preventing copy/paste extraction and search indexing.
- **Automatic Regex Redactions**: Programmatically locate and redact sensitive PII (Aadhaar numbers, SSNs, credit cards, dates of birth) in a single click.
- **Discard Unapplied Redactions**: Easily discard individual pending redactions or bulk-discard all unapplied redaction marks before committing.

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
        permissions={{ canRedact: true }}
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

---

## 🏛️ Architecture & Tech Stack

- **Core Engine**: HTML5, TypeScript, WebAssembly (PDF.js + pdf-lib)
- **UI & State**: React 19, Lucide Icons, Pure CSS Modules
- **Build System**: Vite 8 & Oxlint (Sub-500ms tree-shakable builds)

```
TeamSync-PDF-Viewer/
├── src/
│   ├── components/       # Native React UI (Header, DocumentViewer, Sidebars, Modals)
│   ├── hooks/            # Search & Keyboard shortcut hooks
│   ├── utils/            # Redaction algorithms & vector helpers
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
