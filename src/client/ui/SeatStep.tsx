// 02 좌석 선택: 구역도(SVG) → 구역 좌석 그리드. 보이는 좌석은 "조회 기준" 시각의 스냅샷이다.
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { fmt } from '../../shared/time';
import { GRADES, GRADE_KEYS, seatId, seatOf } from '../../shared/venue';
import type { SeatPicker } from '../game/seatPicker';
import type { BookingGame } from '../game/types';
import { useSession } from './context';
import * as s from './SeatStep.css';
import { btn, gradeColor, muted, swatch } from './shared.css';

const colorVar = (color: string) => assignInlineVars({ [gradeColor]: color });

function ZoneMap({ picker, game }: { picker: SeatPicker; game: BookingGame }) {
  const v = picker.view.value!;
  return (
    <>
      <svg class={s.venueMap} viewBox="0 0 640 400" role="img" aria-label="좌석도">
        <rect class={s.stage} x="220" y="20" width="200" height="44" rx="4" /><text class={s.stageText} x="320" y="47">STAGE</text>
        <rect class={s.floor} x="214" y="82" width="212" height="172" rx="8" />
        {game.venue.zones.map(z => {
          const [x, y, w, h] = z.rect;
          const n = v.zoneCounts[z.id] ?? 0;
          const soldout = n === 0;
          return (
            <g key={z.id} class={s.zone} onClick={() => void picker.load(z.id)}>
              <rect class={s.zoneRect} x={x} y={y} width={w} height={h} rx="5" fill={soldout ? '#d4d4db' : GRADES[z.grade].color} />
              <text class={s.zoneText({ soldout })} x={x + w / 2} y={y + h / 2 - 6}>{z.id}</text>
              <text class={s.zoneText({ soldout, count: true })} x={x + w / 2} y={y + h / 2 + 12}>{soldout ? '매진' : `${n}석`}</text>
            </g>
          );
        })}
      </svg>
      <p class={s.mapNote}>구역을 선택하면 해당 구역의 좌석을 불러옵니다.</p>
    </>
  );
}

function SeatGrid({ picker, game }: { picker: SeatPicker; game: BookingGame }) {
  const z = game.venue.zoneById.get(picker.zone.value!)!;
  const g = GRADES[z.grade];
  const avail = picker.avail.value;
  const selected = picker.selected.value;
  const cells = [];
  for (let r = 1; r <= z.rows; r++) {
    cells.push(<div key={`r${r}`} class={s.rowLabel}>{r}열</div>);
    for (let c = 1; c <= z.cols; c++) {
      const id = seatId(z.id, r, c);
      const on = avail.has(id);
      cells.push(
        <button key={id} class={s.seat({ on, sel: selected.includes(id) })} disabled={!on}
          title={seatOf(game.venue, id).label} onClick={() => picker.toggle(id)} />,
      );
    }
  }
  // 좌석 · 칩의 등급 색은 이 구역 하나라 한 번만 건다
  return (
    <div style={colorVar(g.color)}>
      <div class={s.gridHead}>
        <button class={btn({ kind: 'small' })} onClick={() => void picker.load(null)}>‹ 구역 다시 선택</button>
        <b>{z.name}</b><span class={s.gradeChip}>{g.name}</span>
      </div>
      <div class={s.stageBar}>STAGE 방향</div>
      <div class={s.seatGrid} style={assignInlineVars({ [s.cols]: String(z.cols) })}>{cells}</div>
    </div>
  );
}

/** 접근 제한 중 좌석도 위 카운트다운 (실제 시각 기준 — 게임 시간이 멈춰도 흐른다) */
function BlockedOverlay({ until }: { until: number }) {
  const left = until - useSession().wall.value;
  if (left <= 0) return null;
  return <div class={s.blocked}><b class={s.blockedTitle}>⛔ 접근 제한</b><span>{Math.ceil(left / 1000)}초 후 해제</span></div>;
}

export function SeatStep({ picker, game }: { picker: SeatPicker; game: BookingGame }) {
  const v = picker.view.value;
  const selected = picker.selected.value;
  return (
    <div class={s.layoutGrid}>
      <div class={s.main}>
        <div class={s.toolbar}>
          <button class={btn({ kind: 'small' })} onClick={() => void picker.load(null)}>전체 좌석도</button>
          <button class={btn({ kind: 'small' })} title="새로고침 (F5)" onClick={() => void picker.refresh()}>↻ 새로고침</button>
          <span class={s.snapTime}>{v && <>조회 기준 <b class={s.snapValue}>{game.fmtTime(v.at)}</b></>}</span>
        </div>
        <div class={s.canvas({ loading: picker.busy.value })}>
          {!v ? <div class={s.loadingMsg}>좌석 정보를 불러오는 중…</div>
            : picker.zone.value ? <SeatGrid picker={picker} game={game} /> : <ZoneMap picker={picker} game={game} />}
        </div>
        {game.seatHint && <div class={s.hint}>{game.seatHint}</div>}
        {picker.blockedUntil.value > 0 && <BlockedOverlay until={picker.blockedUntil.value} />}
      </div>
      <aside class={s.side}>
        <div class={s.sideBox}><h4 class={s.sideTitle}>좌석등급 / 잔여석</h4>
          <ul class={s.list}>{v && GRADE_KEYS.map(k => {
            const g = GRADES[k];
            return (
              <li key={k} class={s.gradeRow}>
                <i class={swatch} style={colorVar(g.color)} /><span>{g.name}</span><span class={s.gradePrice}>{fmt.won(g.price)}</span>
                <b class={s.stock({ zero: !v.stock[k] })}>{v.stock[k]}석</b>
              </li>
            );
          })}</ul>
        </div>
        <div class={s.sideBox}><h4 class={s.sideTitle}>선택좌석 <small class={s.sideSub}>최대 {game.maxSeats}매</small></h4>
          <ul class={s.list}>{selected.length
            ? selected.map(id => {
              const seat = seatOf(game.venue, id);
              return <li key={id} class={s.selRow}><i class={swatch} style={colorVar(GRADES[seat.grade].color)} />{GRADES[seat.grade].name} · {seat.label}</li>;
            })
            : <li class={`${s.selRow} ${muted}`}>선택한 좌석이 없습니다.</li>}</ul>
        </div>
        <button class={`${btn({ block: true })} ${s.doneBtn}`} disabled={picker.locking.value} onClick={() => void picker.done()}>
          {picker.locking.value ? '처리 중…' : '좌석선택완료'}
        </button>
      </aside>
    </div>
  );
}
