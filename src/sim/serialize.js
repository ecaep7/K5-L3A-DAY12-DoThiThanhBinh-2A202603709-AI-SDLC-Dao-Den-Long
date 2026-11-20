import { timeLeft } from './world.js';

// Làm tròn 3 chữ số thập phân, tránh -0.
export function r3(v) {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
}
const pos3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];

export function snapshotLine(world) {
  return JSON.stringify({
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.tick,
    state: world.state,
    time_left_s: r3(timeLeft(world)),
    score: world.score,
    player: { pos: pos3(world.player.pos), flames: world.player.flames, carried: world.player.carried },
    lanterns: world.lanterns.map((l) => ({ id: l.id, pos: pos3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: world.shades.map((s) => ({ id: s.id, pos: pos3(s.pos), state: s.stun > 0 ? 'stunned' : 'chase' })),
    motes_active: world.motes.length,
    motes: world.motes.map((m) => ({ id: m.id, pos: pos3(m.pos) })),
  });
}

export function eventLine(ev) {
  return JSON.stringify({ type: 'event', tick: ev.tick, name: ev.name, data: ev.data });
}

export function endLine(world) {
  return JSON.stringify({ type: 'end', ticks: world.tick, state: world.state, score: world.score });
}
