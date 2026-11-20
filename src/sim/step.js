import { TUNING, WORLD } from './tuning.js';
import { within, dist2D, clampToDisc, dirXZ } from './vec.js';
import { inSafeZone, nextShadeId, pickShadePoint, spawnRandomMote, newMote, timeLeft } from './world.js';

const DT = 1 / WORLD.tick_hz;
const toTicks = (s) => Math.round(s * WORLD.tick_hz);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

// Đẩy điểm ra mép vùng an toàn của mọi đèn đã thắp (theo hướng xuyên tâm).
function pushOutOfSafeZones(world, pos) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const l of world.lanterns) {
      if (!l.lit || !within(pos, l.pos, TUNING.safe_radius)) continue;
      const [dx, dz] = dirXZ(l.pos, pos);
      const r = TUNING.safe_radius + WORLD.safe_margin;
      pos[0] = l.pos[0] + dx * r;
      pos[2] = l.pos[2] + dz * r;
      moved = true;
    }
    clampToDisc(pos, world.map.islandRadius);
    if (!moved) break;
  }
}

// Sau khi hết choáng/giật lùi/spawning: về chase nếu Mây trong tầm phát hiện, không thì wander.
function settle(world, s) {
  s.state = dist2D(s.pos, world.player.pos) <= WORLD.shade_detect ? 'chase' : 'wander';
  s.left = 0;
}

function stepShadeTo(s, target, speed) {
  const d = dist2D(s.pos, target);
  if (d > 1e-9) {
    const k = Math.min(speed * DT, d) / d;
    s.pos[0] += (target[0] - s.pos[0]) * k;
    s.pos[2] += (target[2] - s.pos[2]) * k;
  }
}

// Một bước gameplay (1/60 s). input: trạng thái GIỮ { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause }.
// Trả về mảng event { tick, name, data }. Thứ tự các pha: docs/notes/assumptions.md ("Thứ tự xử lý trong tick").
export function step(world, input) {
  const events = [];
  if (world.state !== 'playing') return events;

  world.tick += 1;
  const tick = world.tick;
  const emit = (name, data) => events.push({ tick, name, data });
  const p = world.player;
  if (tick === 1) emit('night_start', { night: world.night });

  // (1) input: cạnh false → true; pause xử lý trước
  const edge = {};
  for (const b of BUTTONS) {
    edge[b] = !!input[b] && !world.prev[b];
    world.prev[b] = !!input[b];
  }
  if (edge.pause) {
    world.paused = !world.paused;
    emit(world.paused ? 'paused' : 'resumed', {});
    if (world.paused) return events;
  } else if (world.paused) {
    return events;
  }
  world.simTick += 1;
  const sim = world.simTick;

  // (2) giảm bộ đếm
  if (p.pulseCd > 0) p.pulseCd -= 1;
  if (p.dashCd > 0) p.dashCd -= 1;
  if (p.invuln > 0) p.invuln -= 1;
  if (p.charm > 0) p.charm -= 1;
  let respawn = false;
  if (p.fallWait > 0) {
    p.fallWait -= 1;
    respawn = p.fallWait === 0;
  }
  for (const s of world.shades) {
    if (s.state === 'stunned' || s.state === 'spawning') {
      s.left -= 1;
      if (s.left <= 0) settle(world, s);
    }
  }
  for (let i = world.motes.length - 1; i >= 0; i--) {
    const m = world.motes[i];
    if (m.ttl === null) continue;
    m.ttl -= 1;
    if (m.ttl <= 0) world.motes.splice(i, 1);
  }

  const falling = p.fallWait > 0;

  // (3) di chuyển Mây: hồi sinh, lướt, chạy, nhảy; rồi kiểm tra rơi
  if (respawn) {
    p.pos = [...world.map.start];
    p.vy = 0;
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.dashLeft = 0;
    p.invuln = WORLD.respawn_invuln_ticks;
  }
  if (!falling) {
    let [mx, mz] = input.move ?? [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];
    if (edge.dash && p.dashCd <= 0 && p.dashLeft <= 0) {
      p.dashCd = toTicks(TUNING.dash_cooldown_s);
      p.dashLeft = toTicks(TUNING.dash_duration_s);
      p.dashDir = [...p.facing];
      emit('dash', {});
    }
    let vx;
    let vz;
    if (p.dashLeft > 0) {
      vx = p.dashDir[0] * TUNING.dash_speed;
      vz = p.dashDir[1] * TUNING.dash_speed;
    } else {
      vx = wx * TUNING.player_speed;
      vz = wz * TUNING.player_speed;
    }
    p.pos[0] += vx * DT;
    p.pos[2] += vz * DT;
    const onIsland = Math.hypot(p.pos[0], p.pos[2]) <= world.map.islandRadius;
    p.grounded = p.pos[1] === 0 && p.vy === 0 && onIsland;
    if (p.dashLeft > 0) {
      p.dashLeft -= 1; // lướt giữ nguyên độ cao
      p.vy = 0;
    } else {
      if (edge.jump && p.grounded) { p.vy = WORLD.jump_speed; p.grounded = false; }
      if (!p.grounded) {
        const prevY = p.pos[1];
        // tích phân chính xác cho gia tốc hằng: y += v·dt − ½g·dt²
        p.pos[1] += p.vy * DT - 0.5 * WORLD.gravity * DT * DT;
        p.vy -= WORLD.gravity * DT;
        if (prevY >= 0 && p.pos[1] <= 0 && onIsland) { p.pos[1] = 0; p.vy = 0; p.grounded = true; }
      }
    }
    p.vel = [vx, p.vy, vz];
    if (p.pos[1] < WORLD.fall_y) {
      const lost = p.carried;
      p.carried = 0;
      p.flames -= 1;
      p.fallWait = WORLD.fall_wait_ticks;
      p.vy = 0;
      p.vel = [0, 0, 0];
      p.dashLeft = 0;
      p.grounded = false;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }
  const active = p.fallWait <= 0; // đang chờ hồi sinh: không nhặt, không bị chạm

  // (4) nhặt đom đóm: gần nhất trước, tới khi đầy
  if (active) {
    const near = world.motes
      .map((m) => ({ m, d: dist2D(m.pos, p.pos) }))
      .filter((x) => within(x.m.pos, p.pos, TUNING.pickup_radius)
        && Math.abs(p.pos[1] - x.m.pos[1]) <= WORLD.pickup_height)
      .sort((a, b) => a.d - b.d);
    for (const { m } of near) {
      if (p.carried >= TUNING.carry_capacity) break;
      world.motes.splice(world.motes.indexOf(m), 1);
      p.carried += 1;
      emit('mote_picked', { carried: p.carried });
    }
  }

  // (5) nạp đèn: đèn chưa sáng gần nhất (bằng nhau → id nhỏ hơn, do thứ tự mảng)
  if (active && edge.interact && p.carried > 0) {
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
        world.score += TUNING.score.per_mote * amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= TUNING.lantern_cost) {
          best.lit = true;
          world.score += TUNING.score.per_lantern;
          emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }
  }

  // (6) vùng an toàn: Bóng Mực đang ở trong vùng của đèn đã sáng bị đẩy ra mép, tối đa 30 tick
  const pushStep = TUNING.safe_radius / WORLD.safe_push_ticks;
  for (const s of world.shades) {
    for (const l of world.lanterns) {
      if (!l.lit || !within(s.pos, l.pos, TUNING.safe_radius)) continue;
      const d = dist2D(s.pos, l.pos);
      const [dx, dz] = dirXZ(l.pos, s.pos);
      const nd = Math.min(d + pushStep, TUNING.safe_radius + WORLD.safe_margin);
      s.pos[0] = l.pos[0] + dx * nd;
      s.pos[2] = l.pos[2] + dz * nd;
    }
    clampToDisc(s.pos, world.map.islandRadius);
  }

  // (7) Tỏa Sáng: tâm = chân + 0.8 m; mục tiêu chốt ngay tick này (khoảng cách 3D ≤ bán kính)
  if (active && edge.pulse && p.carried >= TUNING.pulse_cost && p.pulseCd <= 0) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCd = toTicks(TUNING.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + WORLD.pulse_center_y, p.pos[2]];
    const stunned = [];
    for (const s of world.shades) {
      const d3 = Math.hypot(s.pos[0] - c[0], s.pos[1] - c[1], s.pos[2] - c[2]);
      if (d3 > TUNING.pulse_radius + 1e-9) continue;
      stunned.push(s.id);
      world.score += TUNING.score.per_stun;
      s.state = 'stunned';
      s.left = WORLD.pulse_stun_ticks;
      s.push = { dir: dirXZ(p.pos, s.pos), left: WORLD.pulse_push_ticks };
      s.recoilDir = null;
    }
    emit('pulse', { stunned_ids: stunned });
  }

  // (8) Bóng Mực: đẩy lùi do Tỏa Sáng, giật lùi, đuổi / lang thang
  for (const s of world.shades) {
    const wasInside = inSafeZone(world, s.pos);
    if (s.state === 'spawning') continue;
    if (s.push) {
      const k = TUNING.pulse_push_m / WORLD.pulse_push_ticks;
      s.pos[0] += s.push.dir[0] * k;
      s.pos[2] += s.push.dir[1] * k;
      if (--s.push.left <= 0) s.push = null;
    }
    if (s.state === 'stunned') {
      // đứng yên (chỉ bị đẩy)
    } else if (wasInside) {
      // đang bị vùng an toàn đẩy ra: không tự di chuyển
    } else if (s.state === 'recoil') {
      s.recoilDir ??= dirXZ(p.pos, s.pos);
      const k = WORLD.recoil_m / WORLD.recoil_ticks;
      s.pos[0] += s.recoilDir[0] * k;
      s.pos[2] += s.recoilDir[1] * k;
      if (--s.left <= 0) { s.recoilDir = null; settle(world, s); }
    } else {
      const d = dist2D(s.pos, p.pos);
      if (s.state === 'chase' && d > WORLD.shade_giveup) s.state = 'wander';
      else if (s.state === 'wander' && d <= WORLD.shade_detect) s.state = 'chase';
      if (s.state === 'chase') {
        stepShadeTo(s, p.pos, TUNING.shade_speed);
      } else {
        if (!s.wanderTo || s.wanderLeft <= 0 || dist2D(s.pos, s.wanderTo) < 0.5) {
          const a = world.rng() * 2 * Math.PI;
          const r = Math.sqrt(world.rng()) * (world.map.islandRadius - 2);
          s.wanderTo = [r * Math.cos(a), 0, r * Math.sin(a)];
          s.wanderLeft = WORLD.shade_wander_retarget_ticks;
        }
        s.wanderLeft -= 1;
        stepShadeTo(s, s.wanderTo, WORLD.shade_wander_speed);
      }
    }
    clampToDisc(s.pos, world.map.islandRadius);
    if (!wasInside) pushOutOfSafeZones(world, s.pos);
  }

  // (9) chạm: tối đa 1 lần mất Ngọn Lửa mỗi tick; Bóng đang choáng/giật lùi/spawning/trong vùng an toàn không gây hại
  if (active && p.invuln <= 0) {
    for (const s of world.shades) {
      if (s.state === 'stunned' || s.state === 'recoil' || s.state === 'spawning') continue;
      if (!within(s.pos, p.pos, TUNING.shade_hit_radius)) continue;
      if (Math.abs(s.pos[1] - p.pos[1]) > WORLD.hit_height) continue;
      if (inSafeZone(world, s.pos)) continue;
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      p.flames -= 1;
      p.invuln = toTicks(TUNING.invuln_s);
      for (let i = 0; i < dropped; i++) {
        const a = world.rng() * 2 * Math.PI;
        const r = WORLD.drop_ring_min + world.rng() * (WORLD.drop_ring_max - WORLD.drop_ring_min);
        newMote(world, [p.pos[0] + r * Math.cos(a), 0, p.pos[2] + r * Math.sin(a)], 'dropped', WORLD.mote_ttl_ticks);
      }
      s.state = 'recoil';
      s.left = WORLD.recoil_ticks;
      s.recoilDir = dirXZ(p.pos, s.pos);
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }

  // (10) sinh theo lịch (thực thể mới chỉ tương tác được từ tick sau)
  if (world.randomMotes && sim % WORLD.mote_every_ticks === 0) spawnRandomMote(world);
  if (world.randomShades && sim >= WORLD.shade_spawn_first_tick
      && (sim - WORLD.shade_spawn_first_tick) % WORLD.shade_spawn_every_ticks === 0) {
    const n = sim === WORLD.shade_spawn_first_tick ? WORLD.shade_spawn_first_count : 1;
    for (let i = 0; i < n && world.shades.length < WORLD.shade_max; i++) {
      const pt = pickShadePoint(world);
      if (!pt) break; // hết điểm hợp lệ: bỏ lượt
      const id = nextShadeId(world);
      world.shades.push({
        id, pos: [pt[0], WORLD.shade_y, pt[2]], state: 'spawning', left: 1,
        push: null, recoilDir: null, wanderTo: null, wanderLeft: 0,
      });
      emit('shade_spawned', { id });
    }
  }

  // (11) thắng / thua: hết Ngọn Lửa → thua; còn sống + đủ đèn → thắng (kể cả tick hết giờ); hết giờ → thua
  if (p.flames <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (world.lanterns.every((l) => l.lit)) {
    world.state = 'won';
    world.score += TUNING.score.per_second_left * Math.floor(timeLeft(world))
      + TUNING.score.per_flame_left * p.flames;
    emit('game_over', { result: 'won', reason: 'all_lit' });
  } else if (sim >= world.endTick) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'dawn' });
  }
  return events;
}

export { inSafeZone };
