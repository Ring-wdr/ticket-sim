import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  server: { port: 5173, host: '127.0.0.1' },
  // 가상 서버 Worker는 type: 'module'로 띄운다
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
});
