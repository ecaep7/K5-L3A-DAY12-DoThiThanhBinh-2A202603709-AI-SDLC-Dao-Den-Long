// Mỗi test kiểm một luật trong docs/notes/assumptions.md qua CLI headless thật.
// Kỳ vọng được tính từ luật và số tuning, không chép từ output.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, base, dist } from './helpers.js';

const near = (a, b, eps = 0.0015) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);
const frames = (...f) => ({ frames: f });

describe('di chuyển & nhảy', () => {
  test('đi (0,1) 60 tick ở 6 m/s → z = 6', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, move: [0, 1] }) });
    assert.deepEqual(r.snapAt(60).player.pos, [0, 0, 6]);
  });
  test('cam_yaw 90° xoay hướng: (0,1) → +X', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, move: [0, 1], cam_yaw_deg: 90 }) });
    const [x, , z] = r.snapAt(60).player.pos;
    near(x, 6); near(z, 0);
  });
  test('vector dài hơn 1 được chuẩn hóa: (1,1) → tốc độ 6, không 8.49', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, move: [1, 1] }) });
    const [x, , z] = r.snapAt(60).player.pos;
    near(Math.hypot(x, z), 6); near(x, z);
  });
  test('trường vắng giữ giá trị cũ (move vẫn giữ khi frame sau chỉ có interact)', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, move: [0, 1] }, { tick: 30, interact: true }) });
    assert.deepEqual(r.snapAt(60).player.pos, [0, 0, 6]);
  });
  test('bị chặn ở mép đảo (bán kính 40), không có sự kiện fall', () => {
    const r = run({ ticks: 1200, every: 60, scenario: base(), inputs: frames({ tick: 0, move: [1, 0] }) });
    for (const s of r.snaps) assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) <= 40.0005);
    near(r.snapAt(1200).player.pos[0], 40);
    assert.equal(r.events.filter((e) => e.data?.by === 'fall').length, 0);
    assert.equal(r.end.state, 'playing');
  });
  test('nhảy: đỉnh ≈ v²/2g = 0.9 m, chạm đất lại sau ≈ 0.6 s, không xuống dưới 0', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }) });
    const ys = r.snaps.map((s) => s.player.pos[1]);
    const peak = Math.max(...ys);
    assert.ok(peak > 0.85 && peak <= 0.9, `peak=${peak}`);
    assert.ok(Math.min(...ys) >= 0);
    assert.ok(r.snapAt(10).player.pos[1] > 0);
    assert.equal(r.snapAt(40).player.pos[1], 0);
  });
  test('time_left_s = 300 − bước/60', () => {
    const r = run({ ticks: 120, every: 120, scenario: base() });
    assert.equal(r.snapAt(120).time_left_s, 298);
  });
});

describe('nhặt đom đóm', () => {
  test('trong pickup_radius (đúng 1.5 m) → nhặt ở tick 1, +10 điểm', () => {
    const r = run({ scenario: base({ motes: [[0, 0, 1.5]] }) });
    assert.deepEqual(r.events, [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    assert.equal(r.end.score, 10);
    assert.equal(r.snapAt(1).motes_active, 0);
  });
  test('ngoài pickup_radius (1.51 m) → không nhặt', () => {
    const r = run({ ticks: 5, scenario: base({ motes: [[0, 0, 1.51]] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(5).motes_active, 1);
  });
  test('đầy túi (carry_capacity 10) → không nhặt', () => {
    const r = run({ ticks: 5, scenario: base({ player: { carried: 10 }, motes: [[0, 0, 1]] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(5).motes_active, 1);
    assert.equal(r.snapAt(5).player.carried, 10);
  });
  test('còn chỗ 1 mà có 3 đom đóm gần → chỉ nhặt 1', () => {
    const r = run({ ticks: 5, scenario: base({ player: { carried: 9 }, motes: [[0, 0, 1], [0, 0, 0.5], [1, 0, 0]] }) });
    assert.equal(r.ev('mote_picked').length, 1);
    assert.equal(r.snapAt(5).player.carried, 10);
    assert.equal(r.snapAt(5).motes_active, 2);
  });
  test('nhặt gần nhất trước', () => {
    const r = run({ ticks: 1, scenario: base({ player: { carried: 9 }, motes: [[0, 0, 1], [0, 0, 0.5]] }) });
    assert.deepEqual(r.snapAt(1).motes.map((m) => m.id), ['M1']); // M2 (gần hơn) bị nhặt
  });
  test('2 đom đóm → +20 điểm', () => {
    const r = run({ ticks: 1, scenario: base({ motes: [[0, 0, 1], [1, 0, 0]] }) });
    assert.equal(r.end.score, 20);
    assert.deepEqual(r.ev('mote_picked').map((e) => e.data.carried), [1, 2]);
  });
});

describe('nạp đèn', () => {
  const at25 = (carried, extra = {}) => base({ player: { pos: [0, 0, 22.5], carried }, ...extra }); // cách L1 đúng 2.5 m
  const press = frames({ tick: 0, interact: true });

  test('nạp hết carried khi chưa đủ cost', () => {
    const r = run({ scenario: at25(3), inputs: press });
    assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 3 });
    assert.equal(r.snapAt(1).player.carried, 0);
    assert.equal(r.ev('lantern_lit').length, 0);
  });
  test('nạp tối đa phần còn thiếu; đủ cost → thắp ngay sau deposit, +100', () => {
    const r = run({ scenario: at25(10, { lanterns: [{ id: 'L1', deposited: 3 }] }), inputs: press });
    assert.deepEqual(r.events.map((e) => e.name), ['deposit', 'lantern_lit']);
    assert.equal(r.events[0].data.amount, 2);
    assert.equal(r.snapAt(1).player.carried, 8);
    assert.equal(r.snapAt(1).lanterns[0].lit, true);
    assert.equal(r.end.score, 100);
  });
  test('ngoài interact_radius (2.51 m) → không nạp', () => {
    const r = run({ scenario: base({ player: { pos: [0, 0, 22.49], carried: 3 } }), inputs: press });
    assert.equal(r.events.length, 0);
  });
  test('đèn đã thắp → không nạp thêm, không điểm', () => {
    const r = run({ scenario: at25(5, { lanterns: [{ id: 'L1', lit: true }] }), inputs: press });
    assert.equal(r.events.length, 0);
    assert.equal(r.end.score, 0);
    assert.equal(r.snapAt(1).player.carried, 5);
  });
  test('scenario đặt sẵn lit:true không phát sự kiện, không cộng điểm', () => {
    const r = run({ ticks: 0, scenario: base({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(0).score, 0);
    assert.equal(r.snapAt(0).lanterns[0].lit, true);
  });
  test('nút giữ (interact true liên tục) chỉ kích 1 lần ở cạnh false→true', () => {
    const r = run({ ticks: 30, scenario: at25(2), inputs: press });
    assert.equal(r.ev('deposit').length, 1);
  });
});

describe('tỏa sáng', () => {
  const press = frames({ tick: 0, pulse: true });
  const sc = (shadeX, carried = 5) => base({ player: { carried }, shades: [{ id: 'S1', pos: [shadeX, 0, 0] }] });

  test('trừ 2 đom đóm, choáng, đẩy ra ≥ 4 m, +20 điểm', () => {
    const r = run({ scenario: sc(5), inputs: press });
    assert.deepEqual(r.ev('pulse')[0].data, { stunned_ids: ['S1'] });
    const s = r.snapAt(1);
    assert.equal(s.player.carried, 3);
    assert.equal(s.shades[0].state, 'stunned');
    near(dist(s.shades[0].pos, s.player.pos), 9);
    assert.equal(r.end.score, 20);
  });
  test('ngoài pulse_radius (6.5 m) → stunned_ids rỗng, vẫn tốn đom đóm', () => {
    const r = run({ scenario: sc(6.5), inputs: press });
    assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, []);
    assert.equal(r.snapAt(1).player.carried, 3);
    assert.equal(r.snapAt(1).shades[0].state, 'chase');
  });
  test('thiếu pulse_cost (carried 1) → không tỏa sáng', () => {
    const r = run({ scenario: sc(5, 1), inputs: press });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(1).player.carried, 1);
  });
  test('cooldown 1 s: pulse sau 30 tick bị bỏ, sau 60 tick được', () => {
    const r = run({
      ticks: 300, scenario: base({ player: { carried: 10 } }),
      inputs: frames(
        { tick: 200, pulse: true }, { tick: 201, pulse: false },
        { tick: 230, pulse: true }, { tick: 231, pulse: false },
        { tick: 260, pulse: true }, { tick: 261, pulse: false },
      ),
    });
    assert.deepEqual(r.ev('pulse').map((e) => e.tick), [201, 261]);
    assert.equal(r.snapAt(300).player.carried, 6);
  });
  test('pulse lên con đang choáng: vẫn nằm trong stunned_ids nhưng không cộng per_stun lần 2', () => {
    const r = run({
      ticks: 70, scenario: sc(5, 10),
      inputs: frames({ tick: 0, pulse: true, move: [1, 0] }, { tick: 1, pulse: false }, { tick: 60, pulse: true }),
    });
    assert.deepEqual(r.ev('pulse').map((e) => [e.tick, e.data.stunned_ids]), [[1, ['S1']], [61, ['S1']]]);
    assert.equal(r.snapAt(70).score, 20); // chỉ 1 lần per_stun
    assert.equal(r.snapAt(70).player.carried, 6);
  });
  test('giữ nút pulse liên tục chỉ tỏa sáng 1 lần', () => {
    const r = run({ ticks: 200, scenario: base({ player: { carried: 10 } }), inputs: press });
    assert.equal(r.ev('pulse').length, 1);
  });
  test('choáng 3 s (180 tick) rồi quay lại đuổi; trong lúc choáng đứng yên', () => {
    const r = run({ ticks: 190, scenario: sc(5), inputs: press });
    const x = (t) => r.snapAt(t).shades[0].pos[0];
    assert.equal(r.snapAt(179).shades[0].state, 'stunned');
    assert.equal(r.snapAt(180).shades[0].state, 'chase');
    near(x(100), 9); near(x(180), 9);
    near(x(181), 9 - 3.5 / 60);
  });
});

describe('Bóng Mực', () => {
  test('đuổi người chơi ở 3.5 m/s', () => {
    const r = run({ ticks: 60, scenario: base({ shades: [{ id: 'S1', pos: [10, 0, 0] }] }) });
    near(r.snapAt(60).shades[0].pos[0], 6.5);
  });
  test('vùng an toàn chỉ có ở đèn ĐÃ THẮP: chưa thắp thì đi xuyên, đã thắp thì bị chặn', () => {
    const mk = (lit) => base({
      lanterns: [{ id: 'L1', pos: [20, 0, 0], lit }],
      shades: [{ id: 'S1', pos: [38, 0, 0] }],
    });
    const unlit = run({ ticks: 400, scenario: mk(false) });
    const lit = run({ ticks: 400, scenario: mk(true) });
    const L = [20, 0, 0];
    assert.ok(Math.min(...unlit.snaps.map((s) => dist(s.shades[0].pos, L))) < 5, 'đèn chưa thắp không chặn');
    for (const s of lit.snaps) assert.ok(dist(s.shades[0].pos, L) > 5, 'đèn đã thắp phải chặn');
    near(lit.snapAt(400).shades[0].pos[0], 25.001);
  });
  test('Bóng Mực spawn ở tick 1800 với id S4, cách người chơi ≥ 15 m', () => {
    const shades = [1, 2, 3].map((i) => ({ id: `S${i}`, pos: [38, 0, 0] }));
    const r = run({ ticks: 1900, scenario: { random_motes: false, motes: [], shades, player: { flames: 99 } } });
    const sp = r.ev('shade_spawned');
    assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[1800, 'S4']]);
    const s4 = r.snapAt(1800).shades.find((s) => s.id === 'S4');
    assert.ok(dist(s4.pos, [0, 0, 0]) >= 15);
  });
  test('spawn mỗi 30 s, tối đa 6 con (S4,S5,S6 ở tick 1800/3600/5400)', () => {
    const shades = [1, 2, 3].map((i) => ({ id: `S${i}`, pos: [38, 0, 0] }));
    const r = run({ ticks: 7000, every: 1000, scenario: { random_motes: false, motes: [], shades, player: { flames: 999 } } });
    assert.deepEqual(r.ev('shade_spawned').map((e) => [e.tick, e.data.id]), [[1800, 'S4'], [3600, 'S5'], [5400, 'S6']]);
    assert.equal(r.snapAt(7000).shades.length, 6);
  });
  test('random_shades:false tắt luôn spawn', () => {
    const r = run({ ticks: 4000, scenario: base() });
    assert.equal(r.ev('shade_spawned').length, 0);
    assert.equal(r.snapAt(4000).shades.length, 0);
  });
});

describe('bị chạm', () => {
  test('mất 1 flame, đánh rơi floor(5×0.5)=2 đom đóm; chạm đầu tiên ở tick 9 (khoảng cách ≤ 1)', () => {
    const r = run({ ticks: 12, scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [1.5, 0, 0] }] }) });
    const hit = r.ev('player_hit')[0];
    assert.equal(hit.tick, 9); // 1.5 − 9×3.5/60 = 0.975 ≤ 1, còn 8 bước: 1.033 > 1
    assert.deepEqual(hit.data, { by: 'shade', flames: 2, dropped: 2 });
    assert.equal(r.snapAt(9).player.carried, 3);
  });
  test('bất tử 1.5 s: hai lần chạm cách nhau đúng 90 tick', () => {
    const r = run({ ticks: 100, scenario: base({ player: { flames: 5 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.ev('player_hit').map((e) => e.tick), [1, 91]);
    assert.deepEqual(r.ev('player_hit').map((e) => e.data.flames), [4, 3]);
  });
  test('Bóng Mực đang choáng không gây sát thương, dù người chơi đi xuyên qua nó', () => {
    const r = run({
      ticks: 150, scenario: base({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [5, 0, 0] }] }),
      inputs: frames({ tick: 0, pulse: true, move: [1, 0] }),
    });
    assert.equal(r.ev('pulse')[0].data.stunned_ids[0], 'S1');
    near(r.snapAt(90).player.pos[0], 9, 0.1);
    assert.ok(r.snaps.some((s) => dist(s.shades[0].pos, s.player.pos) < 1 && s.tick < 180), 'phải có lúc đi qua trong 1 m');
    assert.equal(r.ev('player_hit').length, 0);
  });
});

describe('thắng / thua', () => {
  test('hết flames → thua no_flames, dừng ngay', () => {
    const r = run({ ticks: 600, scenario: base({ player: { flames: 1 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [['player_hit', 1], ['game_over', 1]]);
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  });
  test('hết giờ → thua dawn ở tick 60 khi time_left_s = 1', () => {
    const r = run({ ticks: 600, every: 60, scenario: base({ time_left_s: 1 }) });
    assert.deepEqual(r.ev('game_over'), [{ type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }]);
    assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
    assert.equal(r.snapAt(60).time_left_s, 0);
  });
  test('thắp đủ 5 đèn → thắng all_lit; điểm = 100 + giây còn lại + 50×flames', () => {
    const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const r = run({
      scenario: base({ player: { pos: [0, 0, 3], carried: 5 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 5] }], time_left_s: 100 }),
      inputs: frames({ tick: 0, interact: true }),
    });
    assert.deepEqual(r.events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
    const expected = 100 + Math.floor(100 - 1 / 60) * 1 + 3 * 50;
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: expected });
  });
});
