// 02 좌석 선택: 구역도(SVG) → 구역 좌석 그리드. 보이는 좌석은 "조회 기준" 시각의 스냅샷이다.
import { fmt } from '../../shared/time';
import { GRADES, GRADE_KEYS, seatId, seatOf } from '../../shared/venue';
import type { SeatPicker } from '../game/seatPicker';
import type { BookingGame } from '../game/types';
import { useSession } from './context';
import { cx } from './cx';

function ZoneMap({ picker, game }: { picker: SeatPicker; game: BookingGame }) {
  const v = picker.view.value!;
  return (
    <>
      <svg class="venue-map" viewBox="0 0 640 400" role="img" aria-label="좌석도">
        <rect class="stage" x="220" y="20" width="200" height="44" rx="4" /><text class="stage-t" x="320" y="47">STAGE</text>
        <rect class="floor-bg" x="214" y="82" width="212" height="172" rx="8" />
        {game.venue.zones.map(z => {
          const [x, y, w, h] = z.rect;
          const n = v.zoneCounts[z.id] ?? 0;
          return (
            <g key={z.id} class={cx('zone', n === 0 && 'soldout')} onClick={() => void picker.load(z.id)}>
              <rect x={x} y={y} width={w} height={h} rx="5" fill={n > 0 ? GRADES[z.grade].color : '#d4d4db'} />
              <text x={x + w / 2} y={y + h / 2 - 6}>{z.id}</text>
              <text class="cnt" x={x + w / 2} y={y + h / 2 + 12}>{n > 0 ? `${n}석` : '매진'}</text>
            </g>
          );
        })}
      </svg>
      <p class="map-note">구역을 선택하면 해당 구역의 좌석을 불러옵니다.</p>
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
    cells.push(<div key={`r${r}`} class="row-label">{r}열</div>);
    for (let c = 1; c <= z.cols; c++) {
      const id = seatId(z.id, r, c);
      const on = avail.has(id);
      cells.push(
        <button key={id} class={cx('seat', on && 'on', selected.includes(id) && 'sel')} disabled={!on}
          title={seatOf(game.venue, id).label} style={{ '--c': g.color }} onClick={() => picker.toggle(id)} />,
      );
    }
  }
  return (
    <>
      <div class="grid-head">
        <button class="btn-sm" onClick={() => void picker.load(null)}>‹ 구역 다시 선택</button>
        <b>{z.name}</b><span class="g-chip" style={{ '--c': g.color }}>{g.name}</span>
      </div>
      <div class="stage-bar">STAGE 방향</div>
      <div class="seat-grid" style={{ gridTemplateColumns: `36px repeat(${z.cols}, var(--seat))` }}>{cells}</div>
    </>
  );
}

/** 접근 제한 중 좌석도 위 카운트다운 (실제 시각 기준 — 게임 시간이 멈춰도 흐른다) */
function BlockedOverlay({ until }: { until: number }) {
  const left = until - useSession().wall.value;
  if (left <= 0) return null;
  return <div class="seat-blocked"><b>⛔ 접근 제한</b><span>{Math.ceil(left / 1000)}초 후 해제</span></div>;
}

export function SeatStep({ picker, game }: { picker: SeatPicker; game: BookingGame }) {
  const v = picker.view.value;
  const selected = picker.selected.value;
  return (
    <div class={cx('seat-step', picker.busy.value && 'is-loading')}>
      <div class="seat-main">
        <div class="seat-toolbar">
          <button class="btn-sm" onClick={() => void picker.load(null)}>전체 좌석도</button>
          <button class="btn-sm btn-refresh" title="새로고침 (F5)" onClick={() => void picker.refresh()}>↻ 새로고침</button>
          <span class="snap-time">{v && <>조회 기준 <b>{game.fmtTime(v.at)}</b></>}</span>
        </div>
        <div class="seat-canvas">
          {!v ? <div class="seat-loading">좌석 정보를 불러오는 중…</div>
            : picker.zone.value ? <SeatGrid picker={picker} game={game} /> : <ZoneMap picker={picker} game={game} />}
        </div>
        {game.seatHint && <div class="seat-hint">{game.seatHint}</div>}
        {picker.blockedUntil.value > 0 && <BlockedOverlay until={picker.blockedUntil.value} />}
      </div>
      <aside class="seat-side">
        <div class="side-box"><h4>좌석등급 / 잔여석</h4>
          <ul class="grade-list">{v && GRADE_KEYS.map(k => {
            const g = GRADES[k];
            return <li key={k}><i style={{ background: g.color }} /><span class="gn">{g.name}</span><span class="gp">{fmt.won(g.price)}</span><b class={cx(!v.stock[k] && 'zero')}>{v.stock[k]}석</b></li>;
          })}</ul>
        </div>
        <div class="side-box"><h4>선택좌석 <small>최대 {game.maxSeats}매</small></h4>
          <ul class="sel-list">{selected.length
            ? selected.map(id => {
              const s = seatOf(game.venue, id);
              return <li key={id}><i style={{ background: GRADES[s.grade].color }} />{GRADES[s.grade].name} · {s.label}</li>;
            })
            : <li class="muted">선택한 좌석이 없습니다.</li>}</ul>
        </div>
        <button class="btn-primary btn-block btn-done" disabled={picker.locking.value} onClick={() => void picker.done()}>
          {picker.locking.value ? '처리 중…' : '좌석선택완료'}
        </button>
      </aside>
    </div>
  );
}
