import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the static build works from any folder or sub-path (e.g. GitHub Pages).
  base: './',
  // One small bundle (~180 kB gzipped) for both subjects; no need to split it.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
