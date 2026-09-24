// 디자인 토큰 (실제 예매 사이트 톤) · 게임 화면 골격 치수 · 반응형 구간
import { createGlobalTheme, createVar, fallbackVar } from '@vanilla-extract/css';

export const vars = createGlobalTheme(':root', {
  color: {
    brand: '#5b3ff0',
    brandDark: '#4a2fd6',
    brandLight: '#f0ecff',
    accent: '#ff3d5a',
    ink: '#1b1b1f',
    ink2: '#4b4b55',
    mute: '#8a8a96',
    line: '#e6e6ec',
    bg: '#ffffff',
    bg2: '#f6f6f9',
    ok: '#17a34a',
    warn: '#e5484d',
    hud: '#14121f',
  },
  font: {
    body: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
    mono: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  radius: '8px',
  /** 좌석 한 칸 크기 (좁은 화면에서 줄어든다) */
  seat: '16px',
});

export const media = {
  /** 상품 페이지 3단 → 2단 */
  wide: '(max-width: 1100px)',
  /** 취켓팅 피드가 아래로 내려가는 폭 */
  tablet: '(max-width: 900px)',
  phone: '(max-width: 640px)',
} as const;

/**
 * 게임 화면 골격 치수. App의 shell이 게임 모드에 따라 정하고,
 * 고정 위치 요소들(HUD 아래 헤더 · 팝업 · 피드 · 들여다보기 버튼)이 따라 쓴다.
 */
export const layoutVar = {
  /** 위쪽 HUD 높이 */
  hudH: createVar(),
  /** 오른쪽 패널(취켓팅 피드) 폭 */
  sideW: createVar(),
  /** 아래쪽 패널 높이 (좁은 화면의 취켓팅 피드) */
  sideH: createVar(),
};

/** 게임 밖에서는 0 */
export const layout = {
  hudH: fallbackVar(layoutVar.hudH, '0px'),
  sideW: fallbackVar(layoutVar.sideW, '0px'),
  sideH: fallbackVar(layoutVar.sideH, '0px'),
};
