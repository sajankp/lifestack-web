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
    cssCodeSplit: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'vendor-react';
          }
          if (id.includes('@tanstack') || id.includes('axios') || id.includes('zod')) {
            return 'vendor-data';
          }
          if (id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'vendor-ui';
          }
          return 'vendor';
        },
      },
    },
  },
});
