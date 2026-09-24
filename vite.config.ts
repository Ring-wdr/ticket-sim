import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  server: { port: 5173, host: '127.0.0.1' },
  test: { include: ['src/**/*.test.ts'] },
});
