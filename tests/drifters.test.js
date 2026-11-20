// Gió Lạc và Bùa Gió (Ticket-02 Phần 3, K3). Kỳ vọng tính tay từ ticket.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, base, dist } from './helpers.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const nc = (extra = {}) => base({ charms: [], random_drifters: false, ...extra }); // không bùa, không Gió Lạc ngẫu nhiên

describe('Gió Lạc', () => {
  test('chạm khi mang ≥ 1: cướp min(3, mang), chuyển flee, 240 tick sau biến mất cùng đồ cướp', () => {
    const r = run({ night: 2, ticks: 245, every: 1, scenario: nc({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [0, 1.5, 0.5], state: 'chase' }] }) });
    const st = r.ev('drifter_steal');
    assert.equal(st.length, 1);
    assert.equal(st[0].tick, 1);
    assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
    assert.equal(r.snapAt(1).player.flames, 3); // không mất Ngọn Lửa
    assert.deepEqual(r.snapAt(1).drifters.map((d) => [d.state, d.stolen]), [['flee', 3]]);
    assert.equal(r.snapAt(240).drifters.length, 1);
    assert.equal(r.snapAt(241).drifters.length, 0);
  });
  test('mang ít hơn 3 thì cướp hết; mỗi con chỉ cướp 1 lần', () => {
    const r = run({ night: 2, ticks: 60, every: 60, scenario: nc({ player: { carried: 2 }, drifters: [{ id: 'D1', pos: [0, 1.5, 0.5] }] }) });
    assert.equal(r.ev('drifter_steal')[0].data.amount, 2);
    assert.equal(r.ev('drifter_steal').length, 1);
  });
  test('không mang gì thì không cướp, vẫn idle', () => {
    const r = run({ night: 2, ticks: 10, every: 10, scenario: nc({ drifters: [{ id: 'D1', pos: [0, 1.5, 0.5] }] }) });
    assert.equal(r.ev('drifter_steal').length, 0);
    assert.equal(r.snapAt(10).drifters[0].state, 'idle');
  });
  test('mang ≥ 5 và cách ≤ 15 m → chase 7 m/s; mang 4 thì lượn chậm (idle ≤ 2 m/s)', () => {
    const d = [{ id: 'D1', pos: [10, 1.5, 0] }];
    const chase = run({ night: 2, ticks: 30, every: 30, scenario: nc({ player: { carried: 5 }, drifters: d }) }).snapAt(30);
    assert.equal(chase.drifters[0].state, 'chase');
    near(dist(chase.drifters[0].pos, [0, 0, 0]), 10 - 7 * 0.5, 0.01);
    const idle = run({ night: 2, ticks: 30, every: 30, scenario: nc({ player: { carried: 4 }, drifters: d }) }).snapAt(30);
    assert.equal(idle.drifters[0].state, 'idle');
    assert.ok(Math.abs(dist(idle.drifters[0].pos, [10, 0, 0])) <= 2 * 30 / 60 + 0.01);
  });
  test('Tỏa Sáng trúng Gió Lạc đang chase → flee, không cướp', () => {
    const r = run({ night: 2, ticks: 5, every: 5, scenario: nc({ player: { carried: 8 }, drifters: [{ id: 'D1', pos: [0.5, 1.5, 0], state: 'chase' }] }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    assert.equal(r.ev('pulse').length, 1);
    assert.equal(r.ev('drifter_steal').length, 0);
    assert.deepEqual(r.snapAt(5).drifters.map((d) => [d.state, d.stolen]), [['flee', 0]]);
    assert.equal(r.snapAt(5).player.carried, 5);
  });
  test('Tỏa Sáng trúng Gió Lạc đang flee có đồ → thả lại đom đóm rơi, biến mất sau 120 tick', () => {
    const r = run({ night: 2, ticks: 121, every: 1, scenario: nc({ drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }], player: { carried: 3 } }),
      inputs: { frames: [{ tick: 0, pulse: true }] } });
    assert.deepEqual(r.ev('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
    assert.equal(r.snapAt(1).motes.filter((m) => m.kind === 'dropped').length, 3);
    assert.equal(r.snapAt(119).drifters.length, 1);
    assert.equal(r.snapAt(120).drifters.length, 0);
  });
  test('sinh tại tick 1200, 2400 (id D1, D2), tối đa 2; Đêm 1 không có', () => {
    const r = run({ night: 2, ticks: 3700, every: 100, scenario: base({ charms: [] }) });
    assert.deepEqual(r.ev('drifter_spawned').map((e) => [e.tick, e.data.id]), [[1200, 'D1'], [2400, 'D2']]);
    assert.equal(r.snapAt(3700).drifters.length, 2);
    assert.equal(run({ night: 1, ticks: 1300, every: 1300, scenario: base() }).ev('drifter_spawned').length, 0);
  });
});

describe('Bùa Gió', () => {
  const at = (pos, extra = {}) => nc({ player: { pos }, ...extra });
  test('nhặt bùa C1 (35,0,0) Đêm 2: charm_picked 600 tick, bùa chờ 45 s', () => {
    const r = run({ night: 2, ticks: 2, every: 1, scenario: base({ random_drifters: false, player: { pos: [35, 0, 0] } }) });
    assert.deepEqual(r.ev('charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
    assert.equal(r.ev('charm_picked')[0].tick, 1);
    assert.equal(r.snapAt(1).player.charm_s, 10);
    assert.deepEqual([r.snapAt(1).charms[0].available, r.snapAt(1).charms[0].respawn_s], [false, 45]);
  });
  test('bùa xuất hiện lại sau 2700 tick (nhặt lại ở tick 2701)', () => {
    const r = run({ night: 2, ticks: 2710, every: 2710, scenario: base({ random_drifters: false, player: { pos: [35, 0, 0] } }) });
    assert.deepEqual(r.ev('charm_picked').map((e) => e.tick), [1, 2701]);
  });
  test('có bùa: chạy 7.2 m/s; hết bùa (600 tick) về 6', () => {
    const inputs = { frames: [{ tick: 0, move: [1, 0] }] };
    const on = run({ night: 2, ticks: 20, every: 20, scenario: at([-5, 0, 0], { player: { pos: [-5, 0, 0], charm_ticks: 100 } }), inputs }).snapAt(20);
    near(on.player.vel[0], 7.2, 1e-6);
    const off = run({ night: 2, ticks: 20, every: 20, scenario: at([-5, 0, 0]), inputs }).snapAt(20);
    near(off.player.vel[0], 6, 1e-6);
    const ends = run({ night: 2, ticks: 70, every: 70, scenario: nc({ player: { pos: [-5, 0, 0], charm_ticks: 60 } }), inputs }).snapAt(70);
    near(ends.player.vel[0], 6, 1e-6);
  });
  test('có bùa: lướt không hồi chiêu (bấm lại sau 12 tick được); bấm khi đang lướt bị bỏ qua; không bùa thì bị hồi chiêu', () => {
    const inputs = { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }] };
    const withCharm = run({ night: 2, ticks: 40, every: 40, scenario: nc({ player: { charm_ticks: 600 } }), inputs });
    assert.deepEqual(withCharm.ev('dash').map((e) => e.tick), [1, 21]);
    const without = run({ night: 2, ticks: 40, every: 40, scenario: nc(), inputs });
    assert.deepEqual(without.ev('dash').map((e) => e.tick), [1]);
  });
  test('Đêm 3 có 2 bùa C1 (30,0,25), C2 (−30,0,25); Đêm 1 không có bùa', () => {
    const s = run({ night: 3, ticks: 1, every: 1, scenario: base() }).snapAt(1);
    assert.deepEqual(s.charms.map((c) => [c.id, c.pos]), [['C1', [30, 0, 25]], ['C2', [-30, 0, 25]]]);
    assert.deepEqual(run({ night: 1, ticks: 1, every: 1, scenario: base() }).snapAt(1).charms, []);
  });
});
