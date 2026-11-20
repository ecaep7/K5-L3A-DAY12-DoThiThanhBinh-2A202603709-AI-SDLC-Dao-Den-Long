import { TUNING, WORLD } from './tuning.js';
import { mulberry32 } from './rng.js';
import { within } from './vec.js';
import { FormatError } from './errors.js';
import { validateScenario } from './scenario.js';
import { getMap } from './maps.js';

export function makeLanterns(map) {
  return map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0 }));
}

export function inSafeZone(world, pos) {
  return world.lanterns.some((l) => l.lit && within(pos, l.pos, TUNING.safe_radius));
}

export function nextShadeId(world) {
  const used = new Set(world.shades.map((s) => s.id));
  let n = world.shades.length + 1;
  while (used.has(`S${n}`)) n++;
  return `S${n}`;
}

export function newMote(world, pos, kind, ttl, point = -1) {
  world.moteSeq += 1;
  const m = { id: `M${world.moteSeq}`, pos, kind, ttl, point };
  world.motes.push(m);
  return m;
}

// Điểm sinh Bóng Mực hợp lệ: cách người chơi ≥ 15 m, ngoài vùng an toàn, chưa có Bóng Mực ở đó.
export function pickShadePoint(world) {
  const ok = [];
  for (const sp of world.map.shadePoints) {
    if (within(sp, world.player.pos, WORLD.shade_min_spawn_dist - 1e-6)) continue;
    if (inSafeZone(world, sp)) continue;
    if (world.shades.some((s) => within(s.pos, sp, 0.5))) continue;
    ok.push(sp);
  }
  if (!ok.length) return null;
  return ok[Math.floor(world.rng() * ok.length)];
}

// Thêm 1 đom đóm ngẫu nhiên ở một điểm trống (nếu dưới trần). Trả về true nếu có sinh.
export function spawnRandomMote(world) {
  if (world.motes.length >= WORLD.mote_max) return false;
  const taken = new Set(world.motes.map((m) => m.point));
  const free = world.map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
  if (!free.length) return false;
  const i = free[Math.floor(world.rng() * free.length)];
  newMote(world, [...world.map.motePoints[i]], 'random', null, i);
  return true;
}

// Dựng thế giới. Thứ tự gọi PRNG cố định: đom đóm ban đầu → các lần sinh theo lịch.
export function createWorld(seed, scenario = null, night = 1) {
  if (!Number.isSafeInteger(seed)) throw new Error('seed phải là số nguyên');
  const sc = scenario ? validateScenario(scenario) : {};
  const map = getMap(night);
  const rng = mulberry32(seed);

  const player = {
    pos: [...map.start],
    vel: [0, 0, 0],
    vy: 0,
    grounded: true,
    facing: [0, 1], // quay mặt +Z
    flames: TUNING.flames,
    carried: 0,
    invuln: 0, // tick còn lại
    dashCd: 0,
    pulseCd: 0,
    charm: 0,
    dashLeft: 0,
    dashDir: [0, 1],
    fallWait: 0, // > 0: đang chờ hồi sinh sau khi rơi
  };
  const sp = sc.player ?? {};
  if (sp.pos) player.pos = [...sp.pos];
  if ('carried' in sp) player.carried = sp.carried;
  if ('flames' in sp) player.flames = sp.flames;
  if ('invuln_ticks' in sp) player.invuln = sp.invuln_ticks;
  if ('dash_cd_ticks' in sp) player.dashCd = sp.dash_cd_ticks;
  if ('pulse_cd_ticks' in sp) player.pulseCd = sp.pulse_cd_ticks;
  if ('charm_ticks' in sp) player.charm = sp.charm_ticks;
  player.grounded = player.pos[1] === 0 && Math.hypot(player.pos[0], player.pos[2]) <= map.islandRadius;

  const lanterns = makeLanterns(map);
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
    night,
    map,
    tick: 0, // số bước đã chạy (kể cả khi tạm dừng)
    simTick: 0, // số bước gameplay (đứng yên khi tạm dừng)
    state: 'playing',
    paused: false,
    score: 0,
    durationS: 'time_left_s' in sc ? sc.time_left_s : TUNING[map.durationKey],
    player,
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    lanterns,
    motes: [],
    moteSeq: 0,
    shades: [],
    randomShades: sc.random_shades !== false,
    randomMotes: sc.random_motes !== false,
  };
  world.endTick = Math.round(world.durationS * WORLD.tick_hz);

  if ('motes' in sc) {
    for (const m of sc.motes) newMote(world, [...(Array.isArray(m) ? m : m.pos)], 'random', null);
  } else if (world.randomMotes) {
    // chọn 20 trong 24 điểm khác nhau (xáo một phần), giữ thứ tự điểm để id ổn định
    const idx = map.motePoints.map((_, i) => i);
    for (let i = 0; i < WORLD.mote_initial; i++) {
      const j = i + Math.floor(rng() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, WORLD.mote_initial).sort((a, b) => a - b)) {
      newMote(world, [...map.motePoints[i]], 'random', null, i);
    }
  }

  (sc.shades ?? []).forEach((s, i) => {
    const state = s.state ?? 'chase';
    const defLeft = { stunned: WORLD.pulse_stun_ticks, recoil: WORLD.recoil_ticks, spawning: 1 }[state] ?? 0;
    world.shades.push({
      id: s.id ?? `S${i + 1}`, pos: [...s.pos], state, left: s.state_ticks_left ?? defLeft,
      push: null, recoilDir: null, wanderTo: null, wanderLeft: 0,
    });
  });
  return world;
}

export function timeLeft(world) {
  return Math.max(0, world.durationS - world.simTick / WORLD.tick_hz);
}
