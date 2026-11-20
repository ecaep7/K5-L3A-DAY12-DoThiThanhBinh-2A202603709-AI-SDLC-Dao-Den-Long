// Ticket-03 (Contract v1.2): nhiên liệu đèn, châm dầu, hết dầu, thắp lại, Bóng Mực drain,
// luật thắng dawn_survived, sức chứa, điểm. Kỳ vọng tính từ docs/notes/assumptions.md ("Thay đổi Phase 3"), không chép từ output.
// Dầu nội bộ tính theo 1/60: mỗi tick đèn sáng hao 1/60 (bước 2), mỗi Bóng Mực drain hút thêm 5/60.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, base, dist } from './helpers.js';

const frames = (...f) => ({ frames: f });
const press = frames({ tick: 0, interact: true });
const FAR = [0, 0, -35]; // Mây đứng xa mọi thứ (> 12 m so với các vật đặt ở gần gốc tọa độ)
const lamp = (id, pos, extra = {}) => ({ id, pos, lit: true, ...extra });
const r1 = (v) => Math.round(v * 10) / 10;

describe('nhiên liệu: hao và scenario', () => {
  test('đèn đặt lit:true không có fuel → mặc định 100, ever_lit true, relit_count 0', () => {
    const r = run({ ticks: 0, scenario: base({ lanterns: [{ id: 'L1', lit: true }] }) });
    const l = r.snapAt(0).lanterns[0];
    assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [true, 100, true, 0]);
  });
  test('đèn tắt có fuel 0, ever_lit mặc định false; ever_lit đặt tay được', () => {
    const r = run({ ticks: 0, scenario: base({ lanterns: [{ id: 'L2', ever_lit: true }] }) });
    const [l1, l2] = r.snapAt(0).lanterns;
    assert.deepEqual([l1.fuel, l1.ever_lit, l2.fuel, l2.ever_lit], [0, false, 0, true]);
  });
  test('hao 1 đơn vị/giây: fuel 100 → 99 sau 60 tick, → 90 sau 600 tick (chính xác, 1 chữ số thập phân)', () => {
    const r = run({ ticks: 600, every: 60, scenario: base({ lanterns: [lamp('L1', [0, 0, 20])] }) });
    assert.equal(r.snapAt(60).lanterns[0].fuel, 99);
    assert.equal(r.snapAt(600).lanterns[0].fuel, 90);
  });
  test('fuel đặt tay 55.5 xuất đúng ở tick 0; sau 30 tick = 55.0', () => {
    const r = run({ ticks: 30, every: 30, scenario: base({ lanterns: [lamp('L1', [0, 0, 20], { fuel: 55.5 })] }) });
    assert.equal(r.snapAt(0).lanterns[0].fuel, 55.5);
    assert.equal(r.snapAt(30).lanterns[0].fuel, 55);
  });
});

describe('châm dầu', () => {
  const at = (carried, fuel) => base({ player: { pos: [0, 0, 1], carried }, lanterns: [lamp('L1', [0, 0, 0], { fuel })] });

  test('used = min(mang, ceil((100 − fuel)/10)): fuel 30, mang 3 → dùng 3, fuel ≈ 60, +15 điểm', () => {
    const r = run({ scenario: at(3, 30), inputs: press });
    // sau hao của tick 1, fuel = 30 − 1/60; châm 3 × 10 → 59.98 → xuất 60
    assert.deepEqual(r.ev('refuel').map((e) => e.data), [{ lantern_id: 'L1', amount: 3, fuel: 60 }]);
    assert.equal(r.snapAt(1).player.carried, 0);
    assert.equal(r.snapAt(1).lanterns[0].fuel, 60);
    assert.equal(r.end.score, 3 * 5);
  });
  test('mang dư: fuel 95, mang 10 → chỉ dùng ceil(5.02/10) = 1, fuel kẹt ở 100', () => {
    const r = run({ scenario: at(10, 95), inputs: press });
    assert.deepEqual(r.ev('refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 });
    assert.equal(r.snapAt(1).player.carried, 9);
  });
  test('thiếu 10.02 → cần ceil(10.02/10) = 2 đom đóm', () => {
    const r = run({ scenario: at(10, 90.0), inputs: press });
    assert.equal(r.ev('refuel')[0].data.amount, 2);
  });
  test('không có sự kiện deposit/lantern_lit khi châm dầu; sức chứa không đổi', () => {
    const r = run({ scenario: at(3, 30), inputs: press });
    assert.deepEqual(r.events.map((e) => e.name), ['refuel']);
    assert.equal(r.snapAt(1).player.capacity, 10);
  });
  test('mang 0 → không làm gì', () => {
    const r = run({ scenario: at(0, 30), inputs: press });
    assert.equal(r.events.length, 0);
  });
  test('chọn đèn nhận được gần nhất; bằng nhau → id nhỏ hơn (cả đèn sáng lẫn đèn tắt)', () => {
    const sc = (a, b) => base({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [a, b] });
    const near = run({ scenario: sc(lamp('L1', [1.5, 0, 0], { fuel: 50 }), { id: 'L2', pos: [1, 0, 0] }), inputs: press });
    assert.equal(near.ev('deposit')[0].data.lantern_id, 'L2');
    const tie = run({ scenario: sc({ id: 'L3', pos: [0, 0, 1] }, lamp('L2', [0, 0, -1], { fuel: 50 })), inputs: press });
    assert.equal(tie.ev('refuel')[0].data.lantern_id, 'L2');
  });
});

describe('hết dầu và thắp lại', () => {
  test('fuel 1 → hết đúng tick 60: lantern_out, lit false, fuel 0, deposited 0, ever_lit true', () => {
    const r = run({
      ticks: 61, every: 1,
      scenario: base({ lanterns: [lamp('L1', [0, 0, 20], { fuel: 1, deposited: 10 })] }),
    });
    assert.deepEqual(r.ev('lantern_out'), [{ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
    assert.equal(r.snapAt(59).lanterns[0].lit, true);
    assert.equal(r.snapAt(59).lanterns[0].fuel, 0); // còn 1/60, làm tròn khi xuất
    const l = r.snapAt(60).lanterns[0];
    assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
    assert.equal(r.end.state, 'playing');
  });
  test('thắp lại chỉ cần 5 đom đóm: +5×5 +40, lantern_lit relight:true, relit_count 1, fuel 100', () => {
    const r = run({
      scenario: base({ player: { pos: [0, 0, 1], carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], ever_lit: true }] }),
      inputs: press,
    });
    assert.deepEqual(r.events.map((e) => [e.name, e.data]),
      [['deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }], ['lantern_lit', { lantern_id: 'L1', relight: true }]]);
    const l = r.snapAt(1).lanterns[0];
    assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [true, 100, true, 1]);
    assert.equal(r.snapAt(1).player.carried, 2);
    assert.equal(r.end.score, 5 * 5 + 40);
  });
  test('đèn chưa từng sáng vẫn cần 10: 5 đom đóm chỉ nạp dở; 10 → thắp relight:false, +10×5 +100', () => {
    const half = run({ scenario: base({ player: { pos: [0, 0, 1], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] }), inputs: press });
    assert.deepEqual(half.events.map((e) => e.name), ['deposit']);
    assert.equal(half.snapAt(1).lanterns[0].lit, false);
    const full = run({ scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] }), inputs: press });
    assert.deepEqual(full.ev('lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
    assert.equal(full.snapAt(1).lanterns[0].relit_count, 0);
    assert.equal(full.end.score, 10 * 5 + 100);
  });
  test('vòng đời đầy đủ: hết dầu rồi thắp lại bằng 5 đom đóm trong cùng ván', () => {
    const r = run({
      ticks: 70, every: 1,
      scenario: base({ player: { pos: [0, 0, 1], carried: 5 }, lanterns: [lamp('L1', [0, 0, 0], { fuel: 1 })] }),
      inputs: frames({ tick: 65, interact: true }),
    });
    assert.deepEqual(r.events.map((e) => [e.tick, e.name]), [[60, 'lantern_out'], [66, 'deposit'], [66, 'lantern_lit']]);
    assert.equal(r.ev('lantern_lit')[0].data.relight, true);
  });
});

describe('sức chứa tăng dần', () => {
  test('sức chứa = 10 + 2 × successful_lights, tối đa 20', () => {
    const cap = (n) => run({ ticks: 0, scenario: base({ player: { successful_lights: n } }) }).snapAt(0).player.capacity;
    assert.deepEqual([0, 1, 3, 5, 6, 40].map(cap), [10, 12, 16, 20, 20, 20]);
  });
  test('thắp mới và thắp lại đều +1; châm dầu thì không; đèn đặt sẵn không tính', () => {
    const lit1 = run({ scenario: base({ player: { pos: [0, 0, 1], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] }), inputs: press });
    assert.equal(lit1.snapAt(1).player.capacity, 12);
    const relit = run({
      scenario: base({ player: { pos: [0, 0, 1], carried: 5, successful_lights: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], ever_lit: true }] }),
      inputs: press,
    });
    assert.equal(relit.snapAt(1).player.capacity, 14);
    const refuel = run({ scenario: base({ player: { pos: [0, 0, 1], carried: 3 }, lanterns: [lamp('L1', [0, 0, 0], { fuel: 30 })] }), inputs: press });
    assert.equal(refuel.snapAt(1).player.capacity, 10);
  });
  test('nhặt dừng ở sức chứa mới: capacity 16 (3 lần thắp), mang 15, có 3 đom đóm gần → nhặt đúng 1', () => {
    const r = run({
      scenario: base({ player: { carried: 15, successful_lights: 3 }, motes: [[0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0]] }),
    });
    assert.equal(r.snapAt(1).player.carried, 16);
    assert.equal(r.ev('mote_picked').length, 1);
  });
  test('sức chứa mặc định 10, mang 10 thì không nhặt thêm', () => {
    const r = run({ scenario: base({ player: { carried: 10 }, motes: [[0.1, 0, 0]] }) });
    assert.equal(r.ev('mote_picked').length, 0);
  });
});

describe('vùng an toàn theo fuel ≥ 30', () => {
  // Đèn ở gốc, Bóng Mực wander cách 3 m, Mây ở xa. Có vùng → bị đẩy ra 0.2 m/tick; mất vùng → đi về phía đèn yếu.
  const shadeDist = (fuel) => {
    const r = run({
      ticks: 1, every: 1,
      scenario: base({ player: { pos: FAR }, lanterns: [lamp('L1', [0, 0, 0], { fuel })], shades: [{ id: 'S1', pos: [3, 0, 0], state: 'wander' }] }),
    });
    return dist(r.snapAt(1).shades[0].pos, [0, 0, 0]);
  };
  test('đúng 30 (sau hao tick 1) vẫn còn vùng an toàn: Bóng Mực trong 6 m bị đẩy ra 3 → 3.2', () => {
    assert.ok(Math.abs(shadeDist(30 + 1 / 60) - 3.2) < 0.0015);
  });
  test('fuel < 30 mất vùng: Bóng Mực không bị đẩy, còn tiến về đèn yếu (3 → 3 − 2/60)', () => {
    assert.ok(Math.abs(shadeDist(30) - (3 - 2 / 60)) < 0.0015);
  });
  test('Bóng Mực không bị chặn quanh đèn yếu: tới ≤ 2 m rồi drain', () => {
    const r = run({
      ticks: 120, every: 1,
      scenario: base({ player: { pos: FAR }, lanterns: [lamp('L1', [0, 0, 0], { fuel: 20 })], shades: [{ id: 'S1', pos: [5, 0, 0], state: 'wander' }] }),
    });
    assert.ok(r.snaps.some((s) => s.shades[0].state === 'drain' && dist(s.shades[0].pos, [0, 0, 0]) <= 2.0001));
  });
  test('châm dầu lên ≥ 30 khi Bóng Mực trong 6 m: bị đẩy ra mép (0.2 m/tick) và không gây sát thương', () => {
    const r = run({
      ticks: 30, every: 1,
      scenario: base({
        player: { pos: [0, 0, 2], carried: 3, flames: 3 },
        lanterns: [lamp('L1', [0, 0, 0], { fuel: 20 })],
        shades: [{ id: 'S1', pos: [0, 0, 2.5], state: 'drain', target_lantern_id: 'L1' }],
      }),
      inputs: press,
    });
    assert.equal(r.ev('player_hit').length, 0);
    assert.notEqual(r.snapAt(1).shades[0].state, 'drain');
    assert.ok(Math.abs(dist(r.snapAt(5).shades[0].pos, [0, 0, 0]) - (2.5 + 0.2 * 5)) < 0.0015);
    assert.ok(dist(r.snapAt(30).shades[0].pos, [0, 0, 0]) >= 6);
  });
});

describe('Bóng Mực drain', () => {
  const L = (fuel, extra = {}) => lamp('L1', [0, 0, 0], { fuel, ...extra });
  const drainSc = (fuel, shades, player = { pos: FAR }) => base({ player, lanterns: [L(fuel)], shades });

  test('wander đi tới đèn sáng yếu gần nhất (2 m/s): chọn L2 (gần hơn), tiến đúng 2 m sau 60 tick', () => {
    const r = run({
      ticks: 60, every: 60,
      scenario: base({
        player: { pos: [0, 0, -38] },
        lanterns: [lamp('L1', [10, 0, 0], { fuel: 20 }), lamp('L2', [-5, 0, 0], { fuel: 20 })],
        shades: [{ id: 'S1', pos: [0, 0, 10], state: 'wander' }],
      }),
    });
    const [x, , z] = r.snapAt(60).shades[0].pos;
    assert.ok(x < 0, `x=${x} phải về phía L2 (−5, 0, 0)`);
    assert.ok(Math.abs(Math.hypot(x + 5, z) - (Math.hypot(5, 10) - 2)) < 0.01);
  });
  test('bằng khoảng cách → đèn id nhỏ hơn', () => {
    const r = run({
      ticks: 60, every: 60,
      scenario: base({
        player: { pos: [0, 0, -38] },
        lanterns: [lamp('L2', [-10, 0, 0], { fuel: 20 }), lamp('L1', [10, 0, 0], { fuel: 20 })],
        shades: [{ id: 'S1', pos: [0, 0, 10], state: 'wander' }],
      }),
    });
    assert.ok(r.snapAt(60).shades[0].pos[0] > 0, 'phải về phía L1 (+X)');
  });
  test('đèn không yếu (fuel ≥ 30) không bị nhắm: không bao giờ chuyển drain', () => {
    const r = run({ ticks: 300, every: 1, scenario: drainSc(90, [{ id: 'S1', pos: [8, 0, 0], state: 'wander' }]) });
    assert.ok(r.snaps.every((s) => s.shades[0].state !== 'drain'));
  });
  test('đang chase không đổi mục tiêu: Bóng chase đi về phía Mây, không về đèn yếu', () => {
    const r = run({
      ticks: 60, every: 60,
      scenario: base({ player: { pos: [0, 0, 0] }, lanterns: [lamp('L1', [20, 0, 0], { fuel: 10 })], shades: [{ id: 'S1', pos: [8, 0, 0], state: 'chase' }] }),
    });
    assert.ok(r.snapAt(60).shades[0].pos[0] < 8);
  });
  test('cách đèn ≤ 2 m → drain, đứng yên; hút 5/s + hao 1/s: sau 61 tick fuel = 20 − 61/60 − 60×5/60', () => {
    const r = run({ ticks: 61, every: 1, scenario: drainSc(20, [{ id: 'S1', pos: [2, 0, 0], state: 'wander' }]) });
    assert.equal(r.snapAt(1).shades[0].state, 'drain');
    assert.deepEqual(r.snapAt(61).shades[0].pos, [2, 0, 0]);
    assert.equal(r.snapAt(61).lanterns[0].fuel, r1(20 - 61 / 60 - (60 * 5) / 60));
  });
  test('fuel_drain ghi mỗi 60 tick đang hút: tick 61 và 121 (không ghi ở tick 1)', () => {
    const r = run({ ticks: 125, every: 125, scenario: drainSc(29, [{ id: 'S1', pos: [2, 0, 0], state: 'wander' }]) });
    const e = r.ev('fuel_drain');
    assert.deepEqual(e.map((x) => x.tick), [61, 121]);
    assert.deepEqual(e[0].data, { lantern_id: 'L1', shade_id: 'S1', fuel: r1(29 - 61 / 60 - 300 / 60) });
    assert.deepEqual(e[1].data, { lantern_id: 'L1', shade_id: 'S1', fuel: r1(29 - 121 / 60 - 600 / 60) });
  });
  test('nhiều con cộng dồn: 2 con hút 10/s → sau 61 tick fuel = 28 − 61/60 − 2×60×5/60', () => {
    const r = run({
      ticks: 61, every: 61,
      scenario: drainSc(28, [{ id: 'S1', pos: [2, 0, 0], state: 'wander' }, { id: 'S2', pos: [-2, 0, 0], state: 'wander' }]),
    });
    assert.equal(r.snapAt(61).lanterns[0].fuel, r1(28 - 61 / 60 - (2 * 60 * 5) / 60));
  });
  test('đèn cạn khi đang bị hút: lantern_out đúng tick 20 (mỗi tick mất 1+5 trên 120 đơn vị), Bóng Mực về wander', () => {
    const r = run({ ticks: 25, every: 1, scenario: drainSc(2, [{ id: 'S1', pos: [2, 0, 0], state: 'drain', target_lantern_id: 'L1' }]) });
    assert.deepEqual(r.ev('lantern_out').map((e) => e.tick), [20]);
    assert.equal(r.snapAt(19).shades[0].state, 'drain');
    assert.equal(r.snapAt(20).shades[0].state, 'wander');
  });
  test('drain → chase khi Mây vào trong 6 m (6.0 → chase, 6.5 → vẫn drain)', () => {
    const sh = [{ id: 'S1', pos: [2, 0, 0], state: 'drain', target_lantern_id: 'L1' }];
    const near = run({ ticks: 1, every: 1, scenario: drainSc(20, sh, { pos: [2, 0, 6] }) });
    assert.equal(near.snapAt(1).shades[0].state, 'chase');
    const far = run({ ticks: 1, every: 1, scenario: drainSc(20, sh, { pos: [2, 0, 6.5] }) });
    assert.equal(far.snapAt(1).shades[0].state, 'drain');
  });
  test('drain → wander khi cách đèn > 2 m', () => {
    const r = run({ ticks: 1, every: 1, scenario: drainSc(20, [{ id: 'S1', pos: [2.5, 0, 0], state: 'drain', target_lantern_id: 'L1' }]) });
    assert.notEqual(r.snapAt(1).shades[0].state, 'drain');
  });
  test('drain → stunned khi trúng Tỏa Sáng: +15 điểm (so với +5 cho con không drain)', () => {
    const sc = (state) => base({
      player: { pos: [0, 0, 4], carried: 3 }, lanterns: [L(20)],
      shades: [{ id: 'S1', pos: [2, 0, 0], state, target_lantern_id: 'L1' }],
    });
    const d = run({ ticks: 1, every: 1, scenario: sc('drain'), inputs: frames({ tick: 0, pulse: true }) });
    assert.deepEqual(d.ev('pulse')[0].data.stunned_ids, ['S1']);
    assert.equal(d.snapAt(1).shades[0].state, 'stunned');
    assert.equal(d.end.score, 15);
    const w = run({ ticks: 1, every: 1, scenario: sc('wander'), inputs: frames({ tick: 0, pulse: true }) });
    assert.equal(w.end.score, 5);
  });
});

describe('luật thắng dawn_survived', () => {
  const lanterns = (fuels) => fuels.map((f, i) => (f === null ? { id: `L${i + 1}` } : lamp(`L${i + 1}`, [0, 0, 20 + i], { fuel: f })));

  test('hết giờ với 3/5 đèn sáng → thắng dawn_survived; điểm = 50+floor(fuel) mỗi đèn sáng + 50 mỗi Ngọn Lửa', () => {
    const r = run({ ticks: 600, every: 60, scenario: base({ time_left_s: 1, lanterns: lanterns([100, 50.5, 20, null, null]) }) });
    assert.deepEqual(r.ev('game_over'), [{ type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } }]);
    // sau 60 tick mỗi đèn hao đúng 1: 99, 49.5, 19
    const expected = (50 + 99) + (50 + 49) + (50 + 19) + 3 * 50;
    assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'won', score: expected });
  });
  test('chỉ 2/5 đèn sáng → thua dawn, không điểm bình minh', () => {
    const r = run({ ticks: 600, scenario: base({ time_left_s: 1, lanterns: lanterns([100, 100, null, null, null]) }) });
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
    assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
  });
  test('không còn thắng sớm: 5/5 đèn sáng, còn nhiều giờ → ván vẫn tiếp tục', () => {
    const r = run({ ticks: 300, every: 300, scenario: base({ time_left_s: 100, lanterns: lanterns([100, 100, 100, 100, 100]) }) });
    assert.equal(r.end.state, 'playing');
    assert.equal(r.ev('game_over').length, 0);
  });
  test('đèn cạn đúng tick bình minh không được tính là sáng: 3 đèn, một cái hết ở tick 60 → thua dawn', () => {
    const r = run({ ticks: 600, scenario: base({ time_left_s: 1, lanterns: lanterns([100, 100, 1, null, null]) }) });
    assert.deepEqual(r.ev('lantern_out').map((e) => e.tick), [60]);
    assert.deepEqual(r.ev('game_over').map((e) => e.data), [{ result: 'lost', reason: 'dawn' }]);
  });
  test('hết Ngọn Lửa ở tick bình minh → no_flames (không thắng dù đủ đèn)', () => {
    const r = run({
      ticks: 5,
      scenario: base({
        time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lanterns([100, 100, 100, 100, 100]),
        shades: [{ id: 'S1', pos: [0.5, 0, 0], state: 'chase' }],
      }),
    });
    assert.deepEqual(r.ev('game_over').map((e) => [e.tick, e.data]), [[1, { result: 'lost', reason: 'no_flames' }]]);
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  });
  test('thắng không có thưởng thời gian: đèn fuel 0.5 sau hao → floor 0, điểm = 3×50 + 3×50', () => {
    const r = run({ ticks: 6000, scenario: base({ time_left_s: 99.5, lanterns: lanterns([100, 100, 100, null, null]) }) });
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'won', reason: 'dawn_survived' });
    assert.equal(r.end.score, 3 * 50 + 3 * 50);
  });
  test('cả 3 đèn cùng cạn đúng tick bình minh → bước 2 tắt trước khi xét thắng → thua dawn', () => {
    const r = run({ ticks: 6000, scenario: base({ time_left_s: 100, lanterns: lanterns([100, 100, 100, null, null]) }) });
    assert.deepEqual(r.ev('lantern_out').map((e) => e.tick), [6000, 6000, 6000]);
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  });
});

describe('định dạng scenario v1.2', () => {
  const bad = (sc) => run({ ticks: 1, scenario: sc }).code;
  test('fuel ngoài [0,100], ever_lit sai kiểu, successful_lights âm/lẻ, target_lantern_id sai kiểu → mã thoát 2', () => {
    assert.equal(bad(base({ lanterns: [{ id: 'L1', lit: true, fuel: 101 }] })), 2);
    assert.equal(bad(base({ lanterns: [{ id: 'L1', lit: true, fuel: -1 }] })), 2);
    assert.equal(bad(base({ lanterns: [{ id: 'L1', ever_lit: 'yes' }] })), 2);
    assert.equal(bad(base({ player: { successful_lights: -1 } })), 2);
    assert.equal(bad(base({ player: { successful_lights: 1.5 } })), 2);
    assert.equal(bad(base({ shades: [{ pos: [0, 0, 0], state: 'drain', target_lantern_id: 7 }] })), 2);
  });
  test('định dạng đúng → mã thoát 0 (state drain hợp lệ)', () => {
    assert.equal(bad(base({
      lanterns: [{ id: 'L1', lit: true, fuel: 55, ever_lit: true }], player: { successful_lights: 2 },
      shades: [{ pos: [0, 0, 0], state: 'drain', target_lantern_id: 'L1' }],
    })), 0);
  });
});
