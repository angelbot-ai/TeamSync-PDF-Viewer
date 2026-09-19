/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Library build (npm package). The demo/iframe application build lives in vite.config.app.ts.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

import postcss from 'postcss';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function isGreater(v1: string, v2: string): boolean {
  const p1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((p1[i] || 0) > (p2[i] || 0)) return true;
    if ((p1[i] || 0) < (p2[i] || 0)) return false;
  }
  return false;
}

function getReleaseVersion(): string {
  try {
    const gitTag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitTag && gitTag.startsWith('v')) {
      const tagNum = gitTag.slice(1);
      if (tagNum && !isGreater(pkg.version, tagNum)) return tagNum;
    }
  } catch {}
  return pkg.version;
}

const APP_VERSION = getReleaseVersion();

/**
 * Prefix every selector in the EMITTED stylesheet with `.tspdf-root`.
 *
 * dist/style.css bundles `pdfjs-dist/web/pdf_viewer.css` (~900 selectors) written for pdf.js's own
 * standalone viewer, including bare generic class names — `.sidebar`, `.dialog`, `.toggle-button`,
 * `.closeButton`, `.messageBar`. Those collide with host application markup: a host with its own
 * `.sidebar` gets it restyled the moment this stylesheet loads, because the library CSS is injected
 * at runtime and so wins the cascade at equal specificity.
 *
 * This runs at `generateBundle`, i.e. AFTER nesting has been flattened. Rewriting selectors earlier
 * (via css.postcss) prefixes a nested rule as well as its parent and yields dead selectors like
 * `.tspdf-root .annotationLayer .tspdf-root .textWidgetAnnotation`.
 */
function scopeEmittedCss() {
  const SKIP_ATRULES = /^(keyframes|font-face|property|counter-style|page)$/i;
  const scope = (css: string): string => {
    const root = postcss.parse(css);
    root.walkRules((rule: any) => {
      if (rule.parent && rule.parent.type === 'rule') return; // covered by the parent selector
      for (let p = rule.parent; p; p = p.parent) {
        if (p.type === 'atrule' && SKIP_ATRULES.test(String(p.name).replace(/^-\w+-/, ''))) return;
      }
      rule.selectors = rule.selectors.map((sel: string) => {
        const t = sel.trim();
        if (!t || t.includes('.tspdf-root')) return t;
        // :root/html/body hold custom properties the viewer's descendants read, and the viewer
        // root is their ancestor — re-target rather than prefix (`.tspdf-root :root` is dead).
        if (/^(:root|html|body)$/i.test(t)) return '.tspdf-root';
        if (/^(html|body)\b/i.test(t)) return t.replace(/^(html|body)\b/i, '.tspdf-root');
        return `.tspdf-root ${t}`;
      });
    });
    return root.toString();
  };
  return {
    name: 'tspdf-scope-emitted-css',
    // `post` matters: Vite's own CSS plugin emits style.css during generateBundle, so an
    // unordered hook runs before the asset exists and silently does nothing.
    enforce: 'post' as const,
    generateBundle: {
      order: 'post' as const,
      handler(_options: unknown, bundle: Record<string, any>) {
        let touched = 0;
        for (const [file, asset] of Object.entries(bundle)) {
          if (asset.type === 'asset' && file.endsWith('.css')) {
            asset.source = scope(String(asset.source));
            touched++;
          }
        }
        if (touched === 0) {
          throw new Error(
            'tspdf-scope-emitted-css found no CSS asset to scope — the library CSS would ship ' +
              'unscoped and restyle host applications (see the .sidebar collision in 1.2.0).'
          );
        }
      },
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // The demo assets under public/ belong to the application build only.
  publicDir: false,
  server: {
    proxy: {
      '/api/convert': {
        target: 'https://teamsync-office-converter-1.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/convert/, '/forms/libreoffice/convert'),
      },
    },
  },
  plugins: [
    react(),
    scopeEmittedCss(),
    dts({
      // The root tsconfig.json is a solution-style file with `files: []`; pointing the plugin at it
      // emitted a 10-byte `export {}` stub. Use the app config and drop the demo entry.
      tsconfigPath: './tsconfig.app.json',
      entryRoot: 'src',
      outDir: 'dist/src',
      include: ['src'],
      exclude: ['src/demo/**', 'src/**/*.test.*'],
      // Declarations are emitted per-file under dist/src/ (package.json `types` points at
      // dist/src/index.d.ts); no synthetic entry file — that is what produced the 1.0.x stub.
      insertTypesEntry: false,
      rollupTypes: false,
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'teamsync-pdf-viewer.js',
      cssFileName: 'style',
    },
    rollupOptions: {
      // Everything a consumer installs themselves (peers + dependencies) stays external, so the
      // bundle contains only our own code and never inlines pdf.js or its worker.
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'pdf-lib',
        'lucide-react',
        // pdfjs-dist JS stays external; its stylesheet (pdf_viewer.css) is bundled into dist/style.css.
        /^pdfjs-dist(?!.*\.css$)(\/.*)?$/,
      ],
      output: {
        // Every component is client-only; the directive is stripped from sources by Rollup,
        // so re-add it for React Server Components bundlers (Next.js App Router).
        banner: '"use client";',
      },
    },
  },
});
