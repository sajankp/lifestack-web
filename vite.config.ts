import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['sajan.tailc1af5c.ts.net'],
  },
  build: {
    sourcemap: false,
  },
});
