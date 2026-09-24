/** 조건부 클래스 이름: cx('seat', on && 'on', sel && 'sel') → 'seat on' */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');
