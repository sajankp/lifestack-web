import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['e2e/**', 'debug/**', 'node_modules/**', 'dist/**', '.git/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/pages/**',
        'src/main.tsx',
        'src/test/**',
        'e2e/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'vite.config.ts',
        'vitest.config.ts',
      ],
    },
    env: {
      VITE_API_URL: 'http://localhost:8000/v1',
    },
  },
});
