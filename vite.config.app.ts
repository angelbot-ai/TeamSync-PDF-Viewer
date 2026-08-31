/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Vite configuration for the sample web application / iframe package build (Vercel SPA deployment).
 * Entry: index.html -> src/demo/main.tsx (NOT part of the npm library).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
