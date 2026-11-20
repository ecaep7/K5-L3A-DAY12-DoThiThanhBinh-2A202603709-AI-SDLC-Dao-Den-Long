import { timeLeft, capacityOf, fuelOut } from './world.js';
import { WORLD } from './tuning.js';

// Làm tròn 3 chữ số thập phân, tránh -0.
export function r3(v) {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
}
const pos3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const secs = (ticks) => r3(ticks / WORLD.tick_hz);

export function snapshotLine(world) {
  const p = world.player;
  return JSON.stringify({
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.simTick,
    state: world.paused && world.state === 'playing' ? 'paused' : world.state,
    night: world.night,
    time_left_s: r3(timeLeft(world)),
    score: world.score,
    wind: { active: world.wind.active, dir_deg: r3(world.wind.dirDeg) },
    player: {
      pos: pos3(p.pos), vel: pos3(p.vel), grounded: p.grounded, invuln: p.invuln > 0,
      dash_cd_s: secs(p.dashCd), pulse_cd_s: secs(p.pulseCd), charm_s: secs(p.charm),
      flames: p.flames, carried: p.carried, capacity: capacityOf(p),
    },
    lanterns: world.lanterns.map((l) => ({ id: l.id, pos: pos3(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? fuelOut(l) : 0, ever_lit: l.everLit, relit_count: l.relitCount })),
    shades: world.shades.map((s) => ({ id: s.id, pos: pos3(s.pos), state: s.state })),
    motes_active: world.motes.length,
    motes: world.motes.map((m) => ({ id: m.id, pos: pos3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : secs(m.ttl) })),
    drifters: [],
    charms: [],
  });
}

export function eventLine(ev) {
  return JSON.stringify({ type: 'event', tick: ev.tick, name: ev.name, data: ev.data });
}

export function endLine(world) {
  return JSON.stringify({ type: 'end', ticks: world.tick, state: world.state, score: world.score });
}
