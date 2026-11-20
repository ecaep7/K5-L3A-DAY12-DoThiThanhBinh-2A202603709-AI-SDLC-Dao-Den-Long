// Đêm 2 (Đảo Cau) và Đêm 3 (Đảo Chuông) theo Ticket-02 Phần 2. Kỳ vọng tính tay từ ticket, không chép từ output.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, base, dist } from './helpers.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const r2 = (p, c = [0, 0]) => Math.hypot(p[0] - c[0], p[2] - c[1]);

describe('Đêm 2 – Đảo Cau', () => {
  test('6 đèn đúng tọa độ, xuất phát (0,0,0), Đêm 270 s', () => {
    const r = run({ night: 2, ticks: 60, every: 60, scenario: base() });
    assert.equal(r.code, 0, r.stderr);
    const s = r.snapAt(60);
    assert.equal(s.night, 2);
    assert.deepEqual(s.lanterns.map((l) => l.pos), [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
    assert.deepEqual(r.snapAt(0).player.pos, [0, 0, 0]);
    near(s.time_left_s, 270 - 1, 1e-6);
  });
  test('đi trên cầu (x 26..44, |z|≤2) không rơi; bước ra ngoài cầu thì rơi mất 1 lửa', () => {
    const walk = run({ night: 2, ticks: 90, every: 90, scenario: base({ player: { pos: [30, 0, 0] } }),
      inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
    const w = walk.snapAt(90);
    near(w.player.pos[0], 30 + 6 * 1.5, 0.05); // 90 tick × 0.1 m
    assert.equal(w.player.pos[1], 0);
    assert.equal(w.player.grounded, true);
    const off = run({ night: 2, ticks: 120, every: 120, scenario: base({ player: { pos: [35, 0, 10] } }) });
    assert.equal(off.ev('player_hit').filter((e) => e.data.by === 'fall').length, 1);
    assert.equal(off.snapAt(120).player.flames, 2);
  });
  test('bục nhảy (20,0,18): bắn lên, bay khoảng 1.4 s và đáp trong đảo B', () => {
    const r = run({ night: 2, ticks: 100, every: 1, scenario: base({ player: { pos: [20, 0, 18] } }) });
    const j = r.ev('jump_pad');
    assert.equal(j.length, 1);
    assert.equal(j[0].tick, 1);
    const land = r.snaps.find((s) => s.tick > 5 && s.player.grounded);
    assert.ok(land, 'phải đáp xuống');
    assert.ok(land.tick >= 82 && land.tick <= 90, `đáp ở tick ${land.tick}`); // 1.4 s = 84 tick
    assert.ok(r2(land.player.pos, [70, 0]) <= 28, 'đáp trong đảo B');
    assert.equal(land.player.pos[1], 0);
  });
  test('Bóng Mực sinh ở điểm bán kính 26 quanh tâm đảo A hoặc B', () => {
    const r = run({ night: 2, seed: 3, ticks: 301, every: 301, scenario: { random_motes: false } });
    const sh = r.snapAt(301).shades;
    assert.equal(sh.length, 2);
    for (const s of sh) assert.ok(Math.abs(r2(s.pos, [0, 0]) - 26) < 0.1 || Math.abs(r2(s.pos, [70, 0]) - 26) < 0.1, JSON.stringify(s.pos));
  });
});

describe('Đêm 3 – Đảo Chuông', () => {
  test('7 đèn đúng tọa độ (kể cả độ cao), Đêm 300 s', () => {
    const r = run({ night: 3, ticks: 60, every: 60, scenario: base() });
    assert.equal(r.code, 0, r.stderr);
    const s = r.snapAt(60);
    assert.equal(s.night, 3);
    assert.deepEqual(s.lanterns.map((l) => l.pos), [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
    near(s.time_left_s, 300 - 1, 1e-6);
  });
  test('Bóng Mực chạy 4.5 m/s ở Đêm 3 (Đêm 1: 4)', () => {
    const sc = base({ player: { pos: [0, 0, -20] }, shades: [{ id: 'S1', pos: [10, 1, -20], state: 'chase' }] });
    const d3 = dist(run({ night: 3, ticks: 30, every: 30, scenario: sc }).snapAt(30).shades[0].pos, [0, 0, -20]);
    near(d3, 10 - 4.5 * 0.5, 0.01, 'Đêm 3');
    const d1 = dist(run({ night: 1, ticks: 30, every: 30, scenario: sc }).snapAt(30).shades[0].pos, [0, 0, -20]);
    near(d1, 10 - 4 * 0.5, 0.01, 'Đêm 1');
  });
  test('dốc 30°: đi từ r=30 vào r=24 thì lên Y=3 (tầng 1)', () => {
    const c = Math.cos(Math.PI / 6);
    const r = run({ night: 3, ticks: 60, every: 60,
      scenario: base({ player: { pos: [30 * c, 0, 15] } }),
      inputs: { frames: [{ tick: 0, move: [-c, -0.5] }] } });
    const p = r.snapAt(60).player;
    near(p.pos[1], 3, 0.1);
    assert.equal(p.grounded, true);
  });
  test('vách tầng 1 chặn: từ tầng 0 đi vào vành (r=12) không lên được', () => {
    const r = run({ night: 3, ticks: 120, every: 120, scenario: base({ player: { pos: [0, 0, 10] } }),
      inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
    const p = r.snapAt(120).player;
    assert.equal(p.pos[1], 0);
    assert.ok(p.pos[2] <= 12.001, `z=${p.pos[2]}`);
  });
  test('bục (0,3,13): bắn lên và đáp trên tầng 2 (Y=6, r ≤ 8)', () => {
    const r = run({ night: 3, ticks: 80, every: 80, scenario: base({ player: { pos: [0, 3, 13] } }) });
    assert.equal(r.ev('jump_pad').length, 1);
    const p = r.snapAt(80).player;
    assert.equal(p.pos[1], 6);
    assert.equal(p.grounded, true);
    assert.ok(r2(p.pos) <= 8);
  });
  test('gió mạnh: báo trước 2 s (tick 1680), thổi tick 1800–2100 đẩy 2 m/s; tắt bằng wind_enabled=false', () => {
    const r = run({ night: 3, ticks: 2150, every: 50, scenario: base({ player: { pos: [0, 0, -20] } }) });
    assert.deepEqual(r.ev('wind_warning').map((e) => e.tick), [1680]);
    assert.deepEqual(r.ev('wind_start').map((e) => e.tick), [1800]);
    assert.deepEqual(r.ev('wind_end').map((e) => e.tick), [2100]);
    const speed = (t) => Math.hypot(...[r.snapAt(t).player.vel[0], r.snapAt(t).player.vel[2]]);
    near(speed(1850), 2, 0.01);
    near(speed(1700), 0, 1e-6);
    near(speed(2150), 0, 1e-6);
    assert.equal(r.snapAt(1850).wind.active, true);
    assert.equal(r.snapAt(1700).wind.active, false);
    const off = run({ night: 3, ticks: 2150, every: 2150, scenario: base({ wind_enabled: false }) });
    assert.equal(off.ev('wind_start').length, 0);
  });
});
