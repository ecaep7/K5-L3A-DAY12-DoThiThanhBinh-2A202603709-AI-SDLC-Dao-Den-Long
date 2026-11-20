import { TUNING, WORLD, FUEL } from './tuning.js';
import { within, dist2D, clampToDisc, dirXZ } from './vec.js';
import {
  inSafeZone, hasZone, capacityOf, fuelOut, winNeed, nextShadeId, pickShadePoint, spawnRandomMote, newMote,
} from './world.js';

const DT = 1 / WORLD.tick_hz;
const toTicks = (s) => Math.round(s * WORLD.tick_hz);
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

// Đẩy điểm ra mép vùng an toàn của mọi đèn đã thắp (theo hướng xuyên tâm).
function pushOutOfSafeZones(world, pos) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const l of world.lanterns) {
      if (!hasZone(l) || !within(pos, l.pos, TUNING.safe_radius)) continue;
      const [dx, dz] = dirXZ(l.pos, pos);
      const r = TUNING.safe_radius + WORLD.safe_margin;
      pos[0] = l.pos[0] + dx * r;
      pos[2] = l.pos[2] + dz * r;
      moved = true;
    }
    world.map.clampShade(pos);
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

// Đèn sáng có fuel < 30 gần nhất (bằng nhau → id nhỏ hơn, do thứ tự mảng), hoặc null.
function weakLantern(world, pos) {
  let best = null;
  let bestD = Infinity;
  for (const l of world.lanterns) {
    if (!l.lit || l.fuel >= FUEL.low) continue;
    const d = dist2D(l.pos, pos);
    if (d < bestD) { best = l; bestD = d; }
  }
  return best;
}

// Gió mạnh (chỉ bản đồ có `wind`): báo trước `warn` tick, thổi `duration` tick, mỗi `every` tick; hướng chọn bằng PRNG của world lúc báo trước.
function updateWind(world, sim, emit) {
  const w = world.map.wind;
  if (!w || !world.windEnabled) return;
  if ((sim + w.warn) % w.every === 0) {
    world.wind.dirDeg = world.rng() * 360;
    emit('wind_warning', { dir_deg: Math.round(world.wind.dirDeg * 1000) / 1000 });
  }
  if (sim % w.every === 0) { world.wind.active = true; emit('wind_start', {}); }
  if (world.wind.active && sim % w.every === w.duration) { world.wind.active = false; emit('wind_end', {}); }
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
  updateWind(world, sim, emit);
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
  // dầu: hao tự nhiên + bị Bóng Mực hút (cộng dồn); ngay sau đó đèn có fuel <= 0 tắt
  for (const l of world.lanterns) if (l.lit) l.fuel -= FUEL.decayPerTick;
  for (const s of world.shades) {
    if (s.state !== 'drain') continue;
    const l = world.lanterns.find((x) => x.id === s.target);
    if (!l || !l.lit) continue;
    l.fuel -= FUEL.drainPerTick;
    s.drainTicks += 1;
    if (s.drainTicks % WORLD.drain_event_ticks === 0) {
      emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: Math.max(0, fuelOut(l)) });
    }
  }
  for (const l of world.lanterns) {
    if (l.lit && l.fuel <= 0) {
      l.lit = false;
      l.fuel = 0;
      l.deposited = 0;
      l.everLit = true;
      emit('lantern_out', { lantern_id: l.id });
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
    p.launch = null;
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
    const map = world.map;
    let vx;
    let vz;
    if (p.dashLeft > 0) {
      vx = p.dashDir[0] * TUNING.dash_speed;
      vz = p.dashDir[1] * TUNING.dash_speed;
    } else if (p.launch) {
      [vx, vz] = p.launch; // bục nhảy: vận tốc ngang giữ tới khi chạm đất
    } else {
      vx = wx * TUNING.player_speed;
      vz = wz * TUNING.player_speed;
    }
    if (world.wind.active) {
      vx += map.wind.push * Math.cos((world.wind.dirDeg * Math.PI) / 180);
      vz += map.wind.push * Math.sin((world.wind.dirDeg * Math.PI) / 180);
    }
    const ox = p.pos[0];
    const oz = p.pos[2];
    p.pos[0] += vx * DT;
    p.pos[2] += vz * DT;
    if (map.blocked && map.blocked(p.pos[0], p.pos[2], p.pos[1])) { p.pos[0] = ox; p.pos[2] = oz; }
    const h = map.support(p.pos[0], p.pos[2], p.pos[1], WORLD.step_up);
    p.grounded = p.vy === 0 && Number.isFinite(h)
      && (p.pos[1] === h || (p.grounded && Math.abs(p.pos[1] - h) <= WORLD.step_up));
    if (p.grounded) { p.pos[1] = h; p.launch = null; }
    if (p.vy <= 0) {
      for (const pad of map.pads) {
        if (within(p.pos, pad.pos, pad.r) && Math.abs(p.pos[1] - pad.pos[1]) <= 0.5) {
          p.vy = pad.vy;
          p.grounded = false;
          p.launch = [pad.dir[0] * pad.vh, pad.dir[1] * pad.vh];
          emit('jump_pad', {});
          break;
        }
      }
    }
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
        const hl = map.support(p.pos[0], p.pos[2], prevY, 0);
        if (Number.isFinite(hl) && p.pos[1] <= hl) { p.pos[1] = hl; p.vy = 0; p.grounded = true; p.launch = null; }
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
      p.launch = null;
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
      if (p.carried >= capacityOf(p)) break;
      world.motes.splice(world.motes.indexOf(m), 1);
      p.carried += 1;
      emit('mote_picked', { carried: p.carried });
    }
  }

  // (5) tương tác: chọn đèn nhận được (chưa sáng, hoặc sáng nhưng chưa đầy dầu) gần nhất, bằng nhau → id nhỏ hơn
  if (active && edge.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of world.lanterns) {
      if (l.lit && l.fuel >= FUEL.max) continue;
      if (!within(l.pos, p.pos, TUNING.interact_radius)) continue;
      const d = dist2D(l.pos, p.pos);
      if (d < bestD) { best = l; bestD = d; }
    }
    if (best && best.lit) {
      // châm dầu: used = min(đang mang, ceil((100 − fuel) / 10)) — số nguyên trên đơn vị 1/60
      const used = Math.min(p.carried, Math.ceil((FUEL.max - best.fuel) / FUEL.perMote));
      p.carried -= used;
      best.fuel = Math.min(FUEL.max, best.fuel + FUEL.perMote * used);
      world.score += TUNING.score.per_mote * used;
      emit('refuel', { lantern_id: best.id, amount: used, fuel: fuelOut(best) });
    } else if (best) {
      const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
      const amount = Math.min(p.carried, cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        world.score += TUNING.score.per_mote * amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= cost) {
          const relight = best.everLit;
          best.lit = true;
          best.fuel = FUEL.max;
          best.everLit = true;
          if (relight) best.relitCount += 1;
          p.successfulLights += 1;
          world.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
          emit('lantern_lit', { lantern_id: best.id, relight });
        }
      }
    }
  }

  // (6) vùng an toàn: Bóng Mực đang ở trong vùng của đèn đã sáng bị đẩy ra mép, tối đa 30 tick
  const pushStep = TUNING.safe_radius / WORLD.safe_push_ticks;
  for (const s of world.shades) {
    for (const l of world.lanterns) {
      if (!hasZone(l) || !within(s.pos, l.pos, TUNING.safe_radius)) continue;
      const d = dist2D(s.pos, l.pos);
      const [dx, dz] = dirXZ(l.pos, s.pos);
      const nd = Math.min(d + pushStep, TUNING.safe_radius + WORLD.safe_margin);
      s.pos[0] = l.pos[0] + dx * nd;
      s.pos[2] = l.pos[2] + dz * nd;
    }
    world.map.clampShade(s.pos);
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
      world.score += s.state === 'drain' ? TUNING.score.per_stun_drain : TUNING.score.per_stun;
      s.state = 'stunned';
      s.left = WORLD.pulse_stun_ticks;
      s.push = { dir: dirXZ(p.pos, s.pos), left: WORLD.pulse_push_ticks };
      s.recoilDir = null;
      s.target = null;
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
    if (s.state === 'drain') {
      // drain → chase nếu Mây trong 6 m; → wander nếu đèn tắt / fuel >= 30 / cách đèn > 2 m (stunned do Tỏa Sáng đã đặt ở bước 7)
      const l = world.lanterns.find((x) => x.id === s.target);
      if (dist2D(s.pos, p.pos) <= WORLD.drain_chase_range) s.state = 'chase';
      else if (!l || !l.lit || l.fuel >= FUEL.low || dist2D(s.pos, l.pos) > WORLD.drain_range) s.state = 'wander';
      if (s.state !== 'drain') { s.target = null; s.drainTicks = 0; }
    }
    if (s.state === 'stunned') {
      // đứng yên (chỉ bị đẩy)
    } else if (s.state === 'drain') {
      // đứng yên và hút dầu (bước 2)
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
        stepShadeTo(s, p.pos, world.map.shadeSpeed);
      } else if (weakLantern(world, s.pos)) {
        // wander: đi tới đèn sáng yếu (fuel < 30) gần nhất; tới ≤ 2 m thì chuyển drain
        const l = weakLantern(world, s.pos);
        if (dist2D(s.pos, l.pos) <= WORLD.drain_range) {
          s.state = 'drain';
          s.target = l.id;
          s.drainTicks = 0;
        } else {
          stepShadeTo(s, l.pos, WORLD.shade_wander_speed);
        }
      } else {
        if (!s.wanderTo || s.wanderLeft <= 0 || dist2D(s.pos, s.wanderTo) < 0.5) {
          s.wanderTo = world.map.wanderPoint(world.rng);
          s.wanderLeft = WORLD.shade_wander_retarget_ticks;
        }
        s.wanderLeft -= 1;
        stepShadeTo(s, s.wanderTo, WORLD.shade_wander_speed);
      }
    }
    world.map.clampShade(s.pos);
    if (world.map.shadeY) s.pos[1] = world.map.shadeY(s.pos[0], s.pos[2]);
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
  const sc = world.map.shade;
  if (world.randomShades && sim >= sc.first && (sim - sc.first) % sc.every === 0) {
    const n = sim === sc.first ? sc.firstCount : 1;
    for (let i = 0; i < n && world.shades.length < sc.max; i++) {
      const pt = pickShadePoint(world);
      if (!pt) break; // hết điểm hợp lệ: bỏ lượt
      const id = nextShadeId(world);
      world.shades.push({
        id, pos: [pt[0], world.map.shadeY ? world.map.shadeY(pt[0], pt[2]) : WORLD.shade_y, pt[2]], state: 'spawning', left: 1,
        push: null, recoilDir: null, wanderTo: null, wanderLeft: 0,
        target: null, drainTicks: 0,
      });
      emit('shade_spawned', { id });
    }
  }

  // (11) thắng / thua (sau mọi cập nhật): hết Ngọn Lửa → thua no_flames (kể cả tick bình minh);
  // hết giờ → thắng dawn_survived nếu số đèn sáng ≥ ceil(0.6 × tổng), không thì thua dawn
  if (p.flames <= 0) {
    world.state = 'lost';
    emit('game_over', { result: 'lost', reason: 'no_flames' });
  } else if (sim >= world.endTick) {
    const lit = world.lanterns.filter((l) => l.lit);
    if (lit.length >= winNeed(world.lanterns.length)) {
      world.state = 'won';
      for (const l of lit) world.score += TUNING.score.per_lit_at_dawn + Math.floor(l.fuel / FUEL.unit);
      world.score += TUNING.score.per_flame_left * p.flames;
      emit('game_over', { result: 'won', reason: 'dawn_survived' });
    } else {
      world.state = 'lost';
      emit('game_over', { result: 'lost', reason: 'dawn' });
    }
  }
  return events;
}

export { inSafeZone };
