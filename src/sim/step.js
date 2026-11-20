import { TUNING, WORLD } from './tuning.js';
import { within, dist2D, clampToDisc } from './vec.js';
import { inSafeZone, nextShadeId, pickShadeSpawn, timeLeft } from './world.js';

const DT = 1 / WORLD.tick_hz;
const toTicks = (s) => Math.round(s * WORLD.tick_hz);

// Đẩy điểm ra khỏi các vùng an toàn của đèn đã thắp (chiếu theo hướng xuyên tâm).
function pushOutOfSafeZones(world, pos) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const l of world.lanterns) {
      if (!l.lit || !within(pos, l.pos, TUNING.safe_radius)) continue;
      let dx = pos[0] - l.pos[0];
      let dz = pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      const r = TUNING.safe_radius + WORLD.safe_margin;
      pos[0] = l.pos[0] + dx * r;
      pos[2] = l.pos[2] + dz * r;
      moved = true;
    }
    clampToDisc(pos, WORLD.island_radius);
    if (!moved) break;
  }
}

// Một bước gameplay (1/60 s). input: trạng thái GIỮ { move:[x,z], cam_yaw_deg, jump, interact, pulse }.
// Trả về mảng event { tick, name, data }. Thứ tự các pha: xem docs/notes/assumptions.md.
export function step(world, input) {
  const events = [];
  if (world.state !== 'playing') return events;

  world.tick += 1;
  const tick = world.tick;
  const emit = (name, data) => events.push({ tick, name, data });
  const p = world.player;

  // cạnh false → true
  const edge = {};
  for (const b of ['jump', 'interact', 'pulse']) {
    edge[b] = !!input[b] && !world.prev[b];
    world.prev[b] = !!input[b];
  }

  // (2) di chuyển, nhảy, chặn mép đảo
  let [mx, mz] = input.move ?? [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * TUNING.player_speed * DT;
  p.pos[2] += wz * TUNING.player_speed * DT;
  clampToDisc(p.pos, WORLD.island_radius);

  if (edge.jump && p.pos[1] <= 0 && p.vy === 0) p.vy = WORLD.jump_speed;
  if (p.vy !== 0 || p.pos[1] > 0) {
    // tích phân chính xác cho gia tốc hằng: y += v·dt − ½g·dt²
    p.pos[1] += p.vy * DT - 0.5 * WORLD.gravity * DT * DT;
    p.vy -= WORLD.gravity * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // (3) timer
  if (p.cooldown > 0) p.cooldown -= 1;
  if (p.invuln > 0) p.invuln -= 1;

  // (4) nhặt đom đóm: gần nhất trước, tới khi đầy
  const near = world.motes
    .map((m) => ({ m, d: dist2D(m.pos, p.pos) }))
    .filter((x) => within(x.m.pos, p.pos, TUNING.pickup_radius))
    .sort((a, b) => a.d - b.d);
  for (const { m } of near) {
    if (p.carried >= TUNING.carry_capacity) break;
    world.motes.splice(world.motes.indexOf(m), 1);
    p.carried += 1;
    world.score += TUNING.score.per_mote;
    emit('mote_picked', { carried: p.carried });
  }

  // (5) nạp đèn
  if (edge.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of world.lanterns) {
      if (l.lit || !within(l.pos, p.pos, TUNING.interact_radius)) continue;
      const d = dist2D(l.pos, p.pos);
      if (d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= TUNING.lantern_cost) {
          best.lit = true;
          world.score += TUNING.score.per_lantern;
          emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }
  }

  // (6) tỏa sáng
  if (edge.pulse && p.carried >= TUNING.pulse_cost && p.cooldown <= 0) {
    p.carried -= TUNING.pulse_cost;
    p.cooldown = toTicks(TUNING.pulse_cooldown_s);
    const stunned = [];
    for (const s of world.shades) {
      if (!within(s.pos, p.pos, TUNING.pulse_radius)) continue;
      stunned.push(s.id);
      if (s.stun <= 0) world.score += TUNING.score.per_stun;
      s.stun = toTicks(TUNING.pulse_stun_s);
      let dx = s.pos[0] - p.pos[0];
      let dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      s.pos[0] += dx * TUNING.pulse_push_m;
      s.pos[2] += dz * TUNING.pulse_push_m;
      clampToDisc(s.pos, WORLD.island_radius);
      pushOutOfSafeZones(world, s.pos);
    }
    emit('pulse', { stunned_ids: stunned });
  }

  // (7) Bóng Mực: di chuyển (hoặc đứng yên khi choáng), rồi spawn
  for (const s of world.shades) {
    if (s.stun > 0) { s.stun -= 1; continue; }
    const d = dist2D(s.pos, p.pos);
    if (d > 1e-9) {
      const k = Math.min(TUNING.shade_speed * DT, d) / d;
      s.pos[0] += (p.pos[0] - s.pos[0]) * k;
      s.pos[2] += (p.pos[2] - s.pos[2]) * k;
    }
    clampToDisc(s.pos, WORLD.island_radius);
    pushOutOfSafeZones(world, s.pos);
  }
  const spawnEvery = toTicks(WORLD.shade_spawn_every_s);
  if (world.randomShades && tick % spawnEvery === 0 && world.shades.length < WORLD.shade_max) {
    const pos = pickShadeSpawn(world);
    const id = nextShadeId(world);
    world.shades.push({ id, pos, stun: 0 });
    emit('shade_spawned', { id });
  }

  // (8) bị chạm
  if (p.invuln <= 0) {
    for (const s of world.shades) {
      if (s.stun > 0 || !within(s.pos, p.pos, TUNING.shade_hit_radius)) continue;
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      p.flames -= 1;
      p.invuln = toTicks(TUNING.invuln_s);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }

  // (9) kết thúc: thắng xét trước, rồi hết lửa, rồi hết giờ
  if (world.lanterns.every((l) => l.lit)) {
    world.state = 'won';
    world.score += TUNING.score.per_second_left * Math.floor(timeLeft(world))
      + TUNING.score.per_flame_left * p.flames;
    emit('game_over', { result: 'won', reason: 'all_lit' });
  } else if (p.flames <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (tick >= world.endTick) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}

export { inSafeZone };
