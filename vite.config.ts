/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Library build (npm package). The demo/iframe application build lives in vite.config.app.ts.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  // The demo assets under public/ belong to the application build only.
  publicDir: false,
  plugins: [
    react(),
    dts({
      // The root tsconfig.json is a solution-style file with `files: []`; pointing the plugin at it
      // emitted a 10-byte `export {}` stub. Use the app config and drop the demo entry.
      tsconfigPath: './tsconfig.app.json',
      entryRoot: 'src',
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
