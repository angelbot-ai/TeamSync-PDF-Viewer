/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
