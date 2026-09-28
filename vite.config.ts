import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base + hash routing lets the build run from any path, including GitHub Pages project sites.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
