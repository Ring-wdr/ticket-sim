import preact from '@preact/preset-vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 컴포넌트 옆 *.css.ts 스타일을 빌드 때 정적 CSS로 뽑는다 (런타임 비용 없음)
  plugins: [preact(), vanillaExtractPlugin()],
  // 상대 경로: GitHub Pages 프로젝트 주소(/ticket-sim/)에서도 저장소 이름 없이 동작 (해시 라우터라 가능)
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  // 가상 서버 Worker는 type: 'module'로 띄운다
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
});
