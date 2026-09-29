import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the static build works from any folder or sub-path (e.g. GitHub Pages).
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
