import { TUNING, WORLD } from './tuning.js';
import { mulberry32 } from './rng.js';
import { within } from './vec.js';
import { FormatError } from './errors.js';
import { validateScenario } from './scenario.js';

export function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const th = (i * 2 * Math.PI) / TUNING.lantern_count_night1; // L1 ở góc 0 → (0,0,R)
    out.push({
      id: `L${i + 1}`,
      pos: [WORLD.lantern_ring_radius * Math.sin(th), 0, WORLD.lantern_ring_radius * Math.cos(th)],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

export function inSafeZone(world, pos) {
  return world.lanterns.some((l) => l.lit && within(pos, l.pos, TUNING.safe_radius));
}

// Điểm ngẫu nhiên đều trong đĩa bán kính r.
function randomInDisc(rng, r) {
  const a = rng() * 2 * Math.PI;
  const d = Math.sqrt(rng()) * r;
  return [d * Math.cos(a), 0, d * Math.sin(a)];
}

// Chọn vị trí cho Bóng Mực mới: cách người chơi >= 15 m, trong đảo, ngoài vùng an toàn.
export function pickShadeSpawn(world) {
  let pos = null;
  for (let i = 0; i < 100; i++) {
    const p = randomInDisc(world.rng, WORLD.island_radius - 2);
    p[1] = WORLD.shade_y;
    if (!within(p, world.player.pos, WORLD.shade_min_spawn_dist - 1e-6) && !inSafeZone(world, p)) {
      pos = p;
      break;
    }
    pos = p;
  }
  return pos;
}

export function nextShadeId(world) {
  const used = new Set(world.shades.map((s) => s.id));
  let n = world.shades.length + 1;
  while (used.has(`S${n}`)) n++;
  return `S${n}`;
}

// Dựng thế giới. Thứ tự gọi PRNG cố định: đom đóm → Bóng Mực ban đầu → (sau đó) spawn.
export function createWorld(seed, scenario = null) {
  if (!Number.isSafeInteger(seed)) throw new Error('seed phải là số nguyên');
  const sc = scenario ? validateScenario(scenario) : {};
  const rng = mulberry32(seed);

  const player = {
    pos: [0, 0, 0],
    vy: 0,
    flames: TUNING.flames,
    carried: 0,
    invuln: 0, // tick còn lại
    cooldown: 0, // tick còn lại
  };
  if (sc.player) {
    if (sc.player.pos) player.pos = [...sc.player.pos];
    if ('carried' in sc.player) player.carried = sc.player.carried;
    if ('flames' in sc.player) player.flames = sc.player.flames;
  }

  const lanterns = defaultLanterns();
  for (const u of sc.lanterns ?? []) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) throw new FormatError(`scenario: lanterns có id không tồn tại: ${u.id}`);
    if (u.pos) l.pos = [...u.pos];
    if ('lit' in u) l.lit = u.lit;
    if ('deposited' in u) l.deposited = u.deposited;
  }

  const world = {
    seed,
    rng,
    tick: 0,
    state: 'playing',
    score: 0,
    durationS: 'time_left_s' in sc ? sc.time_left_s : TUNING.night1_duration_s,
    player,
    prev: { jump: false, interact: false, pulse: false },
    lanterns,
    motes: [],
    shades: [],
    randomShades: sc.random_shades !== false,
  };
  world.endTick = Math.round(world.durationS * WORLD.tick_hz);

  if ('motes' in sc) {
    world.motes = sc.motes.map((m, i) => ({ id: `M${i + 1}`, pos: [...(Array.isArray(m) ? m : m.pos)] }));
  } else if (sc.random_motes !== false) {
    for (let i = 0; i < WORLD.mote_count; i++) {
      world.motes.push({ id: `M${i + 1}`, pos: randomInDisc(rng, WORLD.mote_spawn_radius) });
    }
  }

  if ('shades' in sc) {
    sc.shades.forEach((s, i) => {
      world.shades.push({ id: s.id ?? `S${i + 1}`, pos: [...s.pos], stun: 0 });
    });
  } else if (world.randomShades) {
    for (let i = 0; i < WORLD.shade_initial; i++) {
      const pos = pickShadeSpawn(world);
      world.shades.push({ id: `S${i + 1}`, pos, stun: 0 });
    }
  }
  return world;
}

export function timeLeft(world) {
  return Math.max(0, world.durationS - world.tick / WORLD.tick_hz);
}
