/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600, // PDF.js worker and crypto libraries (node-forge, pdf-lib) are inherently large standalone bundles
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
          if (id.includes('node_modules/node-forge')) return 'node-forge';
          if (id.includes('node_modules/react')) return 'react-vendor';
        }
      }
    }
  }
})
