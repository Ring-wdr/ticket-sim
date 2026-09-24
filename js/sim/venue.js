// 가상 공연장 "티키타카 아레나" 좌석 배치 · 공연 정보
(function (TS) {
  TS.GRADES = {
    VIP: { name: 'VIP석', price: 165000, color: '#7c5cf0', w: 6 },
    R: { name: 'R석', price: 154000, color: '#1f9d55', w: 2.2 },
    S: { name: 'S석', price: 132000, color: '#1d8fe0', w: 1 },
  };

  TS.SHOW = {
    title: '2026 LUMINA WORLD TOUR 〈AFTERGLOW〉 IN SEOUL',
    artist: 'LUMINA',
    venue: '티키타카 아레나',
    period: '2026.10.10 ~ 2026.10.11',
    runtime: '150분',
    age: '8세 이상 관람가능',
    dates: [
      { key: '1010', label: '2026.10.10(토)', time: '18:00', t: TS.T(2026, 10, 10, 18) },
      { key: '1011', label: '2026.10.11(일)', time: '17:00', t: TS.T(2026, 10, 11, 17) },
    ],
  };

  TS.buildVenue = function () {
    // rect: SVG 좌석도(viewBox 0 0 640 420) 상의 위치
    const Z = (id, name, grade, rows, cols, x, y, w, h) => ({ id, name, grade, rows, cols, rect: [x, y, w, h] });
    const zones = [
      Z('A', '플로어 A구역', 'VIP', 10, 14, 222, 90, 96, 76),
      Z('B', '플로어 B구역', 'VIP', 10, 14, 322, 90, 96, 76),
      Z('C', '플로어 C구역', 'VIP', 10, 14, 222, 170, 96, 76),
      Z('D', '플로어 D구역', 'VIP', 10, 14, 322, 170, 96, 76),
      Z('101', '1층 101구역', 'R', 8, 16, 132, 90, 76, 76),
      Z('102', '1층 102구역', 'R', 8, 16, 132, 170, 76, 76),
      Z('103', '1층 103구역', 'R', 8, 16, 222, 262, 96, 52),
      Z('104', '1층 104구역', 'R', 8, 16, 322, 262, 96, 52),
      Z('105', '1층 105구역', 'R', 8, 16, 432, 90, 76, 76),
      Z('106', '1층 106구역', 'R', 8, 16, 432, 170, 76, 76),
      Z('201', '2층 201구역', 'S', 6, 18, 42, 80, 76, 104),
      Z('202', '2층 202구역', 'S', 6, 18, 42, 190, 76, 104),
      Z('203', '2층 203구역', 'S', 6, 18, 142, 330, 172, 50),
      Z('204', '2층 204구역', 'S', 6, 18, 326, 330, 172, 50),
      Z('205', '2층 205구역', 'S', 6, 18, 522, 80, 76, 104),
      Z('206', '2층 206구역', 'S', 6, 18, 522, 190, 76, 104),
    ];
    const seats = []; const byId = {}; const zoneById = {};
    for (const z of zones) {
      zoneById[z.id] = z;
      for (let r = 1; r <= z.rows; r++) {
        for (let c = 1; c <= z.cols; c++) {
          const id = `${z.id}-${r}-${c}`;
          const front = 1 - (r - 1) / Math.max(1, z.rows - 1); // 앞열일수록 1
          const center = 1 - Math.abs((c - (z.cols + 1) / 2) / z.cols); // 가운데일수록 1
          const s = {
            id, zone: z.id, grade: z.grade, row: r, col: c,
            short: `${z.id}구역 ${r}열 ${c}`,
            label: `${z.name} ${r}열 ${c}번`,
            w: TS.GRADES[z.grade].w * (1 + 0.6 * front) * (0.8 + 0.4 * center), // 봇 선호도
          };
          seats.push(s); byId[id] = s;
        }
      }
    }
    return { zones, seats, byId, zoneById };
  };
})(window.TS);
