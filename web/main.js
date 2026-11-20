import { createWorld, step } from '../src/sim/index.js';
import { getMap } from '../src/sim/maps.js';
import { createRenderer } from './render.js';
import { createHud, NIGHT_NAMES } from './hud.js';
import { createInput } from './input.js';

const STEP = 1 / 60;
const Q = new URLSearchParams(location.search);
const FREEZE = Q.has('freeze');

// Seed chọn ở lớp web (sim không được dùng Date/Math.random). ?seed=123 để chơi lại đúng ván.
const baseSeed = () => (Q.get('seed') !== null && /^-?\d+$/.test(Q.get('seed')) ? Number(Q.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0);

const view = createRenderer(document.body);
const input = createInput(view.domElement);

// Luồng chơi: menu → Đêm → kết quả → (Đêm kế | chơi lại Đêm | menu)
const game = { night: 1, chain: false, chainTotal: 0, scored: false, seed: baseSeed(), world: null, mode: 'menu' };
let acc = 0;
let last = performance.now();

function startNight(night) {
  game.night = night;
  game.scored = false;
  game.world = createWorld(game.seed + night, null, night);
  view.setNight(getMap(night));
  acc = 0;
  game.mode = 'play';
  hud.showMenu(false);
  hud.toast(`Đêm ${night} – ${NIGHT_NAMES[night]}`);
}
const hud = createHud({
  start(mode) {
    game.seed = baseSeed();
    game.chain = mode === 'chain';
    game.chainTotal = 0;
    startNight(game.chain ? 1 : Number(mode));
  },
  restart() { startNight(game.night); },
  next() { startNight(game.night + 1); },
  menu() { game.mode = 'menu'; hud.showMenu(true); },
});

view.setNight(getMap(1));
game.world = createWorld(game.seed + 1, null, 1);
if (FREEZE) { game.mode = 'play'; hud.showMenu(false); } else hud.showMenu(true);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const world = game.world;
  if (FREEZE || game.mode !== 'play') {
    acc = 0;
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
  if (game.mode === 'play' && world.state === 'won' && !game.scored) { game.scored = true; game.chainTotal += world.score; }
  view.sync(world, dt, input.yaw);
  if (game.mode === 'play') {
    hud.update(world, { night: game.night, chain: game.chain, chainTotal: game.chainTotal, hasNext: game.chain && game.night < 3, project: (pos) => view.project(pos) });
  } else {
    document.getElementById('end').style.display = 'none';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__ddl = { get world() { return game.world; }, game, startNight }; // để kiểm tra/gỡ lỗi
