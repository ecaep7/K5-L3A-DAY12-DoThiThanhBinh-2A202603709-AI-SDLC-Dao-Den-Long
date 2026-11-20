// Bản đồ chuẩn (Ticket-02 Phần 2). Góc đo từ +X, tăng dần về phía +Z: (r·cosθ, r·sinθ) trên (X, Z).
// Mỗi bản đồ có: heights(x,z) = các mặt đứng được tại (x,z); support(x,z,y,tol) = mặt cao nhất ≤ y+tol (hoặc -Infinity = hư không);
// blocked(x,z,y) (tùy chọn) = bị vách/vật cản chặn; pads (bục nhảy); shade {every,max}; shadeSpeed; wanderPoint(rng); clampShade(pos).
const ring = (r, startDeg, stepDeg, count, y = 0, cx = 0) => Array.from({ length: count }, (_, i) => {
  const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
  return [cx + r * Math.cos(a), y, r * Math.sin(a)];
});

function supportOf(heights) {
  return (x, z, y, tol = 0) => {
    let best = -Infinity;
    for (const h of heights(x, z)) if (h <= y + tol && h > best) best = h;
    return best;
  };
}

function clampDisc(pos, cx, r) {
  const dx = pos[0] - cx;
  const d = Math.hypot(dx, pos[2]);
  if (d > r) { pos[0] = cx + (dx / d) * r; pos[2] = (pos[2] / d) * r; }
}

// Đêm 1 – Đảo Bến.
const n1Heights = (x, z) => (Math.hypot(x, z) <= 40 ? [0] : []);
export const NIGHT1 = Object.freeze({
  night: 1,
  durationKey: 'night1_duration_s',
  islandRadius: 40,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12),
  shade: { first: 300, firstCount: 2, every: 480, max: 6 },
  shadeSpeed: 4,
  drifters: false,
  charms: [],
  pads: [],
  heights: n1Heights,
  support: supportOf(n1Heights),
  clampShade: (pos) => clampDisc(pos, 0, 40),
  wanderPoint(rng) {
    const a = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * (40 - 2);
    return [r * Math.cos(a), 0, r * Math.sin(a)];
  },
});

// Đêm 2 – Đảo Cau: hai đảo bán kính 28 tại A(0,0,0), B(70,0,0), cầu tre x∈[26,44], |z|≤2; hai bục nhảy.
const inBridge = (x, z) => x >= 26 && x <= 44 && Math.abs(z) <= 2;
const n2Heights = (x, z) => (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || inBridge(x, z) ? [0] : []);
const unit = (a, b) => { const d = Math.hypot(b[0] - a[0], b[2] - a[2]); return [(b[0] - a[0]) / d, (b[2] - a[2]) / d]; };
const padA = [20, 0, 18];
const padB = [50, 0, -18];
export const NIGHT2 = Object.freeze({
  night: 2,
  durationKey: 'night2_duration_s',
  islandRadius: 28,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [...[0, 70].flatMap((cx) => [...ring(10, 0, 90, 4, 0, cx), ...ring(22, 0, 45, 8, 0, cx)])],
  shadePoints: [0, 70].flatMap((cx) => ring(26, 22.5, 45, 8, 0, cx)),
  shade: { first: 300, firstCount: 2, every: 420, max: 8 },
  drifters: true,
  charms: [[35, 0, 0]],
  shadeSpeed: 4,
  pads: [
    { pos: padA, r: 1, vy: 14, vh: 24, dir: unit(padA, [70, 0, 0]) },
    { pos: padB, r: 1, vy: 14, vh: 24, dir: unit(padB, [0, 0, 0]) },
  ],
  heights: n2Heights,
  support: supportOf(n2Heights),
  clampShade(pos) {
    if (n2Heights(pos[0], pos[2]).length) return;
    const best = { d: Infinity, p: null };
    for (const c of [[0, 0], [70, 0]]) {
      const q = [pos[0], pos[1], pos[2]];
      clampDisc(q, c[0], 28);
      const d = Math.hypot(q[0] - pos[0], q[2] - pos[2]);
      if (d < best.d) { best.d = d; best.p = q; }
    }
    const q = [Math.min(44, Math.max(26, pos[0])), pos[1], Math.min(2, Math.max(-2, pos[2]))];
    const d = Math.hypot(q[0] - pos[0], q[2] - pos[2]);
    if (d < best.d) best.p = q;
    pos[0] = best.p[0];
    pos[2] = best.p[2];
  },
  wanderPoint(rng) {
    const a = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * 26;
    const cx = rng() < 0.5 ? 0 : 70;
    return [cx + r * Math.cos(a), 0, r * Math.sin(a)];
  },
});

// Đêm 3 – Đảo Chuông: đảo bán kính 45; tầng 1 (Y=3) vành 12–24 m nửa z>0; tầng 2 (Y=6) đĩa 8 m;
// 2 dốc rộng 3 m ở 30° và 150° (r 30→24, Y 0→3); tháp chuông trụ r=2 cao 8 m trên tầng 2 (đỉnh Y=14); bục (0,3,13).
const RAMPS = [30, 150].map((deg) => { const a = (deg * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; });
function n3Heights(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return [];
  const hs = [0];
  if (z > 0 && r >= 12 && r <= 24) hs.push(3);
  if (r <= 8) hs.push(6);
  if (r <= 2) hs.push(14);
  if (r >= 24 && r <= 30) {
    for (const [ux, uz] of RAMPS) {
      const along = x * ux + z * uz;
      const lat = Math.abs(-x * uz + z * ux);
      if (lat <= 1.5 && along >= 24 && along <= 30) hs.push((3 * (30 - along)) / 6);
    }
  }
  return hs;
}
export const NIGHT3 = Object.freeze({
  night: 3,
  durationKey: 'night3_duration_s',
  islandRadius: 45,
  start: [0, 0, -20],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadePoints: ring(43, 0, 22.5, 16),
  shade: { first: 300, firstCount: 2, every: 360, max: 10 },
  drifters: true,
  charms: [[30, 0, 25], [-30, 0, 25]],
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, vh: 8, dir: [0, -1] }],
  wind: { every: 1800, duration: 300, warn: 120, push: 2 },
  heights: n3Heights,
  support: supportOf(n3Heights),
  // Vách đứng: không đi/bay vào chỗ có mặt cao hơn chân quá 0.2 m (bậc thang nhỏ cho dốc).
  blocked: (x, z, y) => n3Heights(x, z).some((h) => h > y + 0.2) && Math.hypot(x, z) <= 45 && y >= -0.2,
  shadeY: (x, z) => 1 + Math.max(...n3Heights(x, z).filter((h) => h <= 6)),
  clampShade: (pos) => clampDisc(pos, 0, 45),
  wanderPoint(rng) {
    const a = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * 43;
    return [r * Math.cos(a), 0, r * Math.sin(a)];
  },
});

export function getMap(night) {
  if (night === 1) return NIGHT1;
  if (night === 2) return NIGHT2;
  if (night === 3) return NIGHT3;
  throw new Error(`Đêm ${night} không tồn tại`);
}
