import { createWorld, step } from '../src/sim/index.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

const STEP = 1 / 60;
const FREEZE = new URLSearchParams(location.search).has('freeze');

// Seed chọn ở lớp web (sim không được dùng Date/Math.random). ?seed=123 để chơi lại đúng ván.
function pickSeed() {
  const q = new URLSearchParams(location.search).get('seed');
  return q !== null && /^-?\d+$/.test(q) ? Number(q) : (Date.now() >>> 0);
}

const view = createRenderer(document.body);
const input = createInput(view.domElement);
let world = createWorld(pickSeed());
const hud = createHud(() => { world = createWorld((Date.now() ^ (Math.random() * 1e9)) >>> 0); acc = 0; });

let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (FREEZE) {
    acc = 0; // ?freeze=1: chỉ vẽ, không chạy sim (để chụp ảnh/gỡ lỗi)
  } else if (world.state === 'playing') {
    acc += dt;
    while (acc >= STEP && world.state === 'playing') {
      const inp = input.sample();
      world.lastMove = inp.move;
      const events = step(world, inp);
      input.afterStep();
      view.onEvents(events, world);
      hud.onEvents(events);
      acc -= STEP;
    }
  } else {
    acc = 0;
  }
  view.sync(world, dt, input.yaw);
  hud.update(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__ddl = { get world() { return world; } }; // để kiểm tra/gỡ lỗi
