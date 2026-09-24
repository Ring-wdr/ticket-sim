import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  // 상대 경로: GitHub Pages 프로젝트 주소(/ticket-sim/)에서도 저장소 이름 없이 동작 (해시 라우터라 가능)
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  // 가상 서버 Worker는 type: 'module'로 띄운다
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
});
