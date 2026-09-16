/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Vite configuration for the sample web application / iframe package build (Vercel SPA deployment).
 * Entry: index.html -> src/demo/main.tsx (NOT part of the npm library).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function getReleaseVersion(): string {
  try {
    const gitTag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitTag && gitTag.startsWith('v')) {
      const tagNum = gitTag.slice(1);
      if (tagNum) return tagNum;
    }
  } catch {}
  return pkg.version;
}

const APP_VERSION = getReleaseVersion();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api/convert': {
        target: 'https://teamsync-office-converter-1.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/convert/, '/forms/libreoffice/convert'),
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules/react')) return 'react-vendor';
        }
      }
    }
  }
});
