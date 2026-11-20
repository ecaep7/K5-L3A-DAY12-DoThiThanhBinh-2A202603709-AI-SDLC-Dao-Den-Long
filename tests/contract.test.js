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
    assert.equal(c.contract_version, '1.0');
    for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.ok(typeof c[k] === 'string' && c[k]);
  });
  test('tuning khớp src/sim/tuning.js (từng khóa)', () => {
    assert.deepEqual(c.tuning, JSON.parse(JSON.stringify(TUNING)));
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
  test('người chơi ở (0,0,0), 3 flames, 5 đèn, 40 đom đóm, 3 Bóng Mực', () => {
    assert.deepEqual(s.player, { pos: [0, 0, 0], flames: 3, carried: 0 });
    assert.equal(s.lanterns.length, 5);
    assert.equal(s.motes_active, 40);
    assert.deepEqual(s.shades.map((x) => x.id), ['S1', 'S2', 'S3']);
    assert.equal(s.time_left_s, 300);
    assert.equal(s.state, 'playing');
  });
  test('L1 ở (0,0,25); 5 đèn cách đều trên vòng 25 m', () => {
    assert.deepEqual(s.lanterns[0].pos, [0, 0, 25]);
    s.lanterns.forEach((l, i) => {
      assert.ok(Math.abs(Math.hypot(l.pos[0], l.pos[2]) - 25) < 0.002);
      const th = (i * 72 * Math.PI) / 180;
      assert.ok(Math.abs(l.pos[0] - 25 * Math.sin(th)) < 0.002 && Math.abs(l.pos[2] - 25 * Math.cos(th)) < 0.002);
      assert.equal(l.lit, false);
    });
  });
  test('đom đóm nằm trong đảo; Bóng Mực ban đầu cách người chơi ≥ 15 m', () => {
    for (const m of s.motes) assert.ok(Math.hypot(m.pos[0], m.pos[2]) <= 40);
    for (const x of s.shades) assert.ok(Math.hypot(x.pos[0], x.pos[2]) >= 15 - 0.001);
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
  test('2: scenario sai kiểu (pos là chuỗi; id đèn lạ)', () => {
    assert.equal(run({ scenario: { player: { pos: 'giữa' } } }).code, 2);
    assert.equal(run({ scenario: { shades: [{ pos: [1, 2] }] } }).code, 2);
    assert.equal(run({ scenario: { lanterns: [{ id: 'L9' }] } }).code, 2);
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
