import { createWorld, step, timeLeft } from '../src/sim/index.js';
import { getMap } from '../src/sim/maps.js';
import { createRenderer } from './render.js';
import { createHud, NIGHT_NAMES } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const STEP = 1 / 60;
const Q = new URLSearchParams(location.search);
const FREEZE = Q.has('freeze');

// Seed chọn ở lớp web (sim không được dùng Date/Math.random). ?seed=123 để chơi lại đúng ván.
const baseSeed = () => (Q.get('seed') !== null && /^-?\d+$/.test(Q.get('seed')) ? Number(Q.get('seed')) : (Date.now() ^ (Math.random() * 1e9)) >>> 0);

const view = createRenderer(document.body);
const input = createInput(view.domElement);
const audio = createAudio();

// Cài đặt (lưu localStorage; có thể không dùng được → vẫn chạy)
const settings = { volume: 60, sens: 100 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') ?? '{}')); } catch { /* bỏ qua */ }
const applySettings = () => { audio.setVolume(settings.volume / 100); input.setSensitivity(settings.sens / 100); };
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* bỏ qua */ } };
applySettings();

// Luồng chơi: menu → Đêm → kết quả → (Đêm kế | chơi lại Đêm | menu)
const game = { paused: false, prevCeil: null, prevVy: 0, night: 1, chain: false, chainTotal: 0, scored: false, seed: baseSeed(), world: null, mode: 'menu' };
let acc = 0;
let last = performance.now();

function startNight(night) {
  game.night = night;
  game.scored = false;
  game.world = createWorld(game.seed + night, null, night);
  view.setNight(getMap(night));
  acc = 0;
  game.mode = 'play';
  game.paused = false;
  game.prevCeil = null;
  hud.showPause(false);
  hud.showMenu(false);
  audio.unlock();
  audio.resume();
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
  menu() { game.mode = 'menu'; game.paused = false; hud.showPause(false); hud.showMenu(true); },
  resume() { setPaused(false); },
  pauseRestart() { startNight(game.night); },
  settings: {
    get: () => settings,
    set(key, v) { settings[key] = v; applySettings(); saveSettings(); },
  },
});

function setPaused(on) {
  if (game.mode !== 'play' || game.world.state !== 'playing') return;
  game.paused = on;
  hud.showPause(on);
  if (on) audio.suspend(); else audio.resume();
}
addEventListener('keydown', (e) => {
  if (e.repeat || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
  if (document.getElementById('settings').style.display === 'flex') return;
  setPaused(!game.paused);
});

view.setNight(getMap(1));
game.world = createWorld(game.seed + 1, null, 1);
if (FREEZE) { game.mode = 'play'; hud.showMenu(false); } else hud.showMenu(true);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const world = game.world;
  if (FREEZE || game.mode !== 'play' || game.paused) { // tạm dừng: không bước sim, thời gian đứng yên
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
      audio.onEvents(events);
      const vy = world.player.vy;
      if (vy > 6.9 && game.prevVy <= 0) audio.sfx.jump(); // nhảy / bục nhảy
      game.prevVy = vy;
      acc -= STEP;
    }
  } else {
    acc = 0;
  }
  if (game.mode === 'play' && world.state === 'won' && !game.scored) { game.scored = true; game.chainTotal += world.score; }
  if (game.mode === 'play' && !game.paused && world.state === 'playing') {
    const c = Math.ceil(timeLeft(world)); // đếm ngược 10 s cuối: mỗi giây một tiếng tích
    if (c !== game.prevCeil && c <= 10 && c > 0 && game.prevCeil !== null) audio.sfx.tick();
    game.prevCeil = c;
  }
  view.sync(world, dt, input.yaw);
  if (game.mode === 'play') {
    hud.update(world, { night: game.night, chain: game.chain, chainTotal: game.chainTotal, hasNext: game.chain && game.night < 3, project: (pos) => view.project(pos) });
  } else {
    document.getElementById('end').style.display = 'none';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__ddl = { get world() { return game.world; }, game, startNight, setPaused }; // để kiểm tra/gỡ lỗi
