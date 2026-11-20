// Cảnh benchmark Ticket-04 mục 1. Chỉ vẽ + đo; luật game không đổi (sim dùng lại nguyên).
// Tắt trong cảnh bench: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu, kết thúc Đêm, nhân vật/hiệu ứng sáng tạo.
// Bóng Mực di chuyển theo luật wander (cùng hằng số WORLD, cùng PRNG của world); không đuổi Mây, không bị đẩy khỏi vùng an toàn.
import { createWorld, mulberry32, WORLD } from '../src/sim/index.js';
import { clampToDisc } from '../src/sim/vec.js';
import { createRenderer } from './render.js';

const q = new URLSearchParams(location.search);
const SEED = Number(q.get('seed') ?? 42);
const DURATION_S = Number(q.get('duration') ?? 30);
const WARMUP_S = 3;
const STEP = 1 / WORLD.tick_hz;

// Vị trí rải đều trên đảo theo seed (đều theo diện tích): r = sqrt(u)·(R − 2).
const rng = mulberry32(SEED);
const spread = (n) => Array.from({ length: n }, () => {
  const a = rng() * 2 * Math.PI;
  const r = Math.sqrt(rng()) * (WORLD.island_radius - 2);
  return [r * Math.cos(a), 0, r * Math.sin(a)];
});
const scenario = {
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: spread(100),
  shades: spread(200).map((pos, i) => ({ id: `S${i + 1}`, pos, state: 'wander' })),
  lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
};
const world = createWorld(SEED, scenario, 1); // Mây ở (0,0,0), Đêm 1
const view = createRenderer(document.body);

function stepShades() {
  for (const s of world.shades) {
    if (!s.wanderTo || s.wanderLeft <= 0 || Math.hypot(s.pos[0] - s.wanderTo[0], s.pos[2] - s.wanderTo[2]) < 0.5) {
      const a = world.rng() * 2 * Math.PI;
      const r = Math.sqrt(world.rng()) * (world.map.islandRadius - 2);
      s.wanderTo = [r * Math.cos(a), 0, r * Math.sin(a)];
      s.wanderLeft = WORLD.shade_wander_retarget_ticks;
    }
    s.wanderLeft -= 1;
    const dx = s.wanderTo[0] - s.pos[0];
    const dz = s.wanderTo[2] - s.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 1e-9) {
      const k = Math.min(WORLD.shade_wander_speed * STEP, d) / d;
      s.pos[0] += dx * k;
      s.pos[2] += dz * k;
    }
    clampToDisc(s.pos, world.map.islandRadius);
  }
}

// Camera: bán kính 30 m, cao 15 m, 15 s/vòng, xuất phát (30,15,0). Ngược chiều kim đồng hồ khi nhìn từ trên xuống
// (+X sang phải, +Z xuống dưới màn hình) nên đi về phía −Z.
const cam = (tSec) => {
  const a = (2 * Math.PI * tSec) / 15;
  return { pos: [30 * Math.cos(a), 15, -30 * Math.sin(a)], look: [0, 0, 0] };
};

const dts = [];
let t0 = null;
let prev = null;
let acc = 0;
window.__bench = { done: false, dts, firstFrameAt: null };

function frame(now) {
  if (t0 === null) t0 = now;
  const t = (now - t0) / 1000;
  const dt = prev === null ? 0 : (now - prev) / 1000;
  prev = now;
  acc += Math.min(0.1, dt);
  while (acc >= STEP) { stepShades(); acc -= STEP; }
  view.sync(world, dt, 0, cam(t));
  if (window.__bench.firstFrameAt === null) window.__bench.firstFrameAt = performance.timeOrigin + performance.now();
  if (t >= WARMUP_S && dt > 0) dts.push(dt * 1000);
  if (t >= WARMUP_S + DURATION_S) { window.__bench.done = true; return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__bench.info = () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' };
};
