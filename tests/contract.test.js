// Kiểm tra Test Contract v1.0: file contract, tham số CLI, mô hình tick, JSONL, mã thoát.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { run, runCli, base, writeTmp, ROOT } from './helpers.js';
import { TUNING, mulberry32 } from '../src/sim/index.js';

describe('game.contract.json', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  test('trường bắt buộc', () => {
    assert.equal(c.contract_version, '1.3');
    for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.ok(typeof c[k] === 'string' && c[k]);
  });
  test('tuning khớp src/sim/tuning.js (từng khóa)', () => {
    assert.deepEqual(c.tuning, JSON.parse(JSON.stringify(TUNING)));
  });
  test('tuning đúng số chuẩn Ticket-02 + Ticket-03 (viết tay từ ticket, không chép từ code)', () => {
    const t = c.tuning;
    assert.deepEqual(
      [t.player_speed, t.carry_capacity, t.lantern_cost, t.pickup_radius, t.interact_radius, t.pulse_cost, t.pulse_radius,
        t.pulse_cooldown_s, t.pulse_stun_s, t.pulse_push_m, t.safe_radius, t.shade_speed, t.shade_hit_radius, t.flames,
        t.invuln_s, t.hit_drop_ratio, t.dash_speed, t.dash_duration_s, t.dash_cooldown_s,
        t.night1_duration_s, t.night2_duration_s, t.night3_duration_s, t.fall_enabled,
        t.fuel_max, t.fuel_decay_per_s, t.fuel_per_mote, t.relight_cost, t.win_ratio, t.drain_per_s, t.low_fuel_threshold, t.capacity_max],
      [6, 10, 10, 1, 2, 3, 5, 3, 2, 4, 6, 4, 1, 3, 1.5, 0.5, 14, 0.2, 1.5, 240, 270, 300, true,
        100, 1.0, 10, 5, 0.6, 5, 30, 20],
    );
    // điểm Ticket-03 Phần 5 (thưởng thời gian bỏ → không còn per_second_left)
    assert.deepEqual(t.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_at_dawn: 50, per_flame_left: 50 });
  });
  test('tuning khớp bảng trong assumptions.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'docs', 'notes', 'assumptions.md'), 'utf8');
    for (const [k, v] of Object.entries(c.tuning)) {
      if (k === 'score') continue;
      const m = new RegExp(`\\b${k}\\s*\\|\\s*([\\w.]+)`).exec(md);
      assert.ok(m, `assumptions.md thiếu ${k}`);
      assert.equal(String(v), m[1], k);
    }
    for (const [k, v] of Object.entries(c.tuning.score)) {
      assert.match(md, new RegExp(`${k}\\s+${v}\\b`), `score.${k}`);
    }
  });
});

describe('PRNG', () => {
  test('cùng seed → cùng chuỗi; khác seed → khác', () => {
    const a = mulberry32(5), b = mulberry32(5), c = mulberry32(6);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    assert.deepEqual(sa, sb);
    assert.notDeepEqual(sa, sc);
    assert.ok(sa.every((x) => x >= 0 && x < 1));
  });
});

describe('thế giới mặc định (Đêm 1)', () => {
  const r = run({ seed: 3, ticks: 0 });
  const s = r.snapAt(0);
  test('người chơi ở (0,0,0), 3 flames, 5 đèn, 20 đom đóm, chưa có Bóng Mực, 240 s, sức chứa 10', () => {
    assert.equal(s.player.flames, 3);
    assert.equal(s.player.carried, 0);
    assert.deepEqual(s.player.pos, [0, 0, 0]);
    assert.deepEqual(s.player.vel, [0, 0, 0]);
    assert.equal(s.player.grounded, true);
    assert.equal(s.player.invuln, false);
    assert.equal(s.lanterns.length, 5);
    assert.equal(s.motes_active, 20);
    assert.deepEqual(s.shades, []);
    assert.equal(s.time_left_s, 240);
    assert.equal(s.player.capacity, 10);
    assert.equal(s.state, 'playing');
    assert.equal(s.night, 1);
    assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
    assert.deepEqual(s.drifters, []);
    assert.deepEqual(s.charms, []);
  });
  test('5 đèn đúng tọa độ chuẩn của ticket', () => {
    assert.deepEqual(s.lanterns.map((l) => l.pos),
      [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
    assert.ok(s.lanterns.every((l) => l.lit === false && l.deposited === 0 && l.fuel === 0 && l.ever_lit === false && l.relit_count === 0));
  });
  test('20 đom đóm ở 20 điểm khác nhau thuộc 8 điểm r=12 (mỗi 45°) ∪ 16 điểm r=33 (mỗi 22.5°)', () => {
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push([12 * Math.cos(i * Math.PI / 4), 12 * Math.sin(i * Math.PI / 4)]);
    for (let i = 0; i < 16; i++) pts.push([33 * Math.cos(i * Math.PI / 8), 33 * Math.sin(i * Math.PI / 8)]);
    const used = new Set();
    for (const m of s.motes) {
      assert.equal(m.kind, 'random');
      assert.equal(m.ttl_s, null);
      assert.equal(m.pos[1], 0);
      const k = pts.findIndex((q) => Math.abs(q[0] - m.pos[0]) < 0.002 && Math.abs(q[1] - m.pos[2]) < 0.002);
      assert.ok(k >= 0, `đom đóm ${m.id} không nằm trên điểm sinh nào`);
      used.add(k);
    }
    assert.equal(used.size, 20);
  });
  test('seed khác → bố trí đom đóm khác', () => {
    assert.notDeepEqual(run({ seed: 4, ticks: 0 }).snapAt(0).motes, s.motes);
  });
});

describe('tham số CLI & mô hình tick', () => {
  test('--ticks N chạy đúng N bước; snapshot mỗi 10 tick mặc định, bắt đầu từ 0', () => {
    const r = run({ ticks: 25, every: 10, scenario: base() });
    assert.equal(r.code, 0);
    assert.deepEqual(r.snaps.map((x) => x.tick), [0, 10, 20]);
    assert.equal(r.end.ticks, 25);
  });
  test('không truyền --snapshot-every thì mặc định 10', () => {
    const out = writeTmp('o.jsonl', '');
    const { code } = runCli(['--seed', '1', '--night', '1', '--ticks', '30', '--out', out]);
    assert.equal(code, 0);
    const ticks = fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      .filter((l) => l.type === 'snapshot').map((l) => l.tick);
    assert.deepEqual(ticks, [0, 10, 20, 30]);
  });
  test('snapshot tick 0 là trạng thái trước khi áp input; sự kiện của bước k ghi tick k+1', () => {
    const r = run({
      ticks: 3, scenario: base({ motes: [[0, 0, 1]] }),
      inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    });
    assert.deepEqual(r.snapAt(0).player.pos, [0, 0, 0]);
    assert.equal(r.snapAt(1).player.pos[2], 0.1);
    assert.equal(r.ev('mote_picked')[0].tick, 1);
  });
  test('JSONL: dòng đầu snapshot, dòng cuối end, sim_tick = tick, tọa độ ≤ 3 chữ số thập phân', () => {
    const r = run({ seed: 9, ticks: 200, every: 7 });
    assert.equal(r.lines[0].type, 'snapshot');
    assert.equal(r.lines.at(-1).type, 'end');
    assert.equal(r.lines.filter((l) => l.type === 'end').length, 1);
    for (const s of r.snaps) assert.equal(s.sim_tick, s.tick);
    assert.doesNotMatch(r.text, /\.\d{4,}/);
  });
  test('dừng khi game kết thúc: end.state khớp snapshot cuối', () => {
    const r = run({ ticks: 1000, scenario: base({ time_left_s: 2 }) });
    assert.equal(r.end.ticks, 120);
    assert.equal(r.end.state, 'lost');
  });
});

describe('mã thoát', () => {
  test('0 khi bình thường', () => assert.equal(run({ ticks: 5 }).code, 0));
  test('2: inputs có tick không tăng nghiêm ngặt', () => {
    const r = run({ scenario: base(), inputs: { frames: [{ tick: 5 }, { tick: 5 }] } });
    assert.equal(r.code, 2);
    assert.ok(r.stderr.length > 0);
  });
  test('2: inputs có move ngoài [-1,1] / sai kiểu', () => {
    assert.equal(run({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
    assert.equal(run({ inputs: { frames: [{ tick: 0, interact: 'yes' }] } }).code, 2);
  });
  test('2: inputs/scenario không phải JSON', () => {
    assert.equal(run({ inputs: 1, raw: { inputs: '{ hỏng' } }).code, 2);
    assert.equal(run({ scenario: 1, raw: { scenario: 'xyz' } }).code, 2);
  });
  test('2: trường mới của v1.1 sai kiểu (state lạ, cờ không phải boolean, charms không phải mảng)', () => {
    assert.equal(run({ scenario: { shades: [{ pos: [1, 0, 1], state: 'dancing' }] } }).code, 2);
    assert.equal(run({ scenario: { shades: [{ pos: [1, 0, 1], state_ticks_left: -1 }] } }).code, 2);
    assert.equal(run({ scenario: { wind_enabled: 'yes' } }).code, 2);
    assert.equal(run({ scenario: { charms: {} } }).code, 2);
    assert.equal(run({ scenario: { player: { dash_cd_ticks: 1.5 } } }).code, 2);
    assert.equal(run({ inputs: { frames: [{ tick: 0, dash: 1 }] } }).code, 2);
    assert.equal(run({ inputs: { frames: [{ tick: 0, pause: 'x' }] } }).code, 2);
  });
  test('2: scenario sai kiểu (pos là chuỗi; id đèn lạ)', () => {
    assert.equal(run({ scenario: { player: { pos: 'giữa' } } }).code, 2);
    assert.equal(run({ scenario: { shades: [{ pos: [1, 2] }] } }).code, 2);
    assert.equal(run({ scenario: { lanterns: [{ id: 'L9' }] } }).code, 2);
  });
  test('--night: 0 và 4 bị từ chối (mã 1); 2, 3 chưa làm ở K1 nên mã 1 kèm thông báo', () => {
    for (const n of ['0', '4', '2', '3']) {
      const r = runCli(['--seed', '1', '--night', n, '--ticks', '1', '--out', writeTmp('o', '')]);
      assert.equal(r.code, 1, `night ${n}`);
      assert.ok(r.stderr.length > 0);
    }
  });
  test('khác 0 (và ≠ 2) khi thiếu tham số hoặc không đọc được file', () => {
    for (const args of [['--night', '1', '--ticks', '1', '--out', 'x'], ['--seed', '1', '--night', '1', '--out', 'x'],
      ['--seed', 'a', '--night', '1', '--ticks', '1', '--out', 'x'], ['--bogus', '1']]) {
      const r = runCli(args);
      assert.equal(r.code, 1, args.join(' '));
      assert.ok(r.stderr.length > 0);
    }
    const r = runCli(['--seed', '1', '--night', '1', '--ticks', '1', '--out', writeTmp('o', ''), '--scenario', 'khong-co.json']);
    assert.equal(r.code, 1);
  });
});
