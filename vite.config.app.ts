/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Vite configuration for Sample Web Application Build (Vercel SPA Deployment)
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
          if (id.includes('node_modules/react')) return 'react-vendor';
        }
      }
    }
  }
});
