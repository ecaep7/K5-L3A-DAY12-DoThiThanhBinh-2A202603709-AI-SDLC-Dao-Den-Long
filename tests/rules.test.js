// Mỗi test kiểm một luật trong docs/notes/assumptions.md (số chuẩn Ticket-02) qua CLI headless thật.
// Kỳ vọng được tính từ luật và số tuning, không chép từ output.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run, base, dist } from './helpers.js';

const near = (a, b, eps = 0.0015) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);
const frames = (...f) => ({ frames: f });
const STEP = 1 / 60;

describe('di chuyển', () => {
  test('đi (0,1) 60 tick ở 6 m/s → z = 6; vận tốc trong snapshot = [0,0,6]', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: frames({ tick: 0, move: [0, 1] }) });
    assert.deepEqual(r.snapAt(60).player.pos, [0, 0, 6]);
    assert.deepEqual(r.snapAt(30).player.vel, [0, 0, 6]);
  });
  test('dừng ngay khi thả phím (≤ 0.1 s): move [0,0] ở tick 30 → đứng yên từ tick 31', () => {
    const r = run({ ticks: 40, scenario: base(), inputs: frames({ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }) });
    near(r.snapAt(36).player.pos[2], r.snapAt(30).player.pos[2], 0.6); // dừng trong ≤ 6 tick
    assert.equal(r.snapAt(40).player.pos[2], r.snapAt(39).player.pos[2]);
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
  test('time_left_s = 240 − bước/60 (Đêm 1 dài 240 s)', () => {
    const r = run({ ticks: 120, every: 120, scenario: base() });
    assert.equal(r.snapAt(120).time_left_s, 238);
  });
});

describe('nhảy', () => {
  const jump = frames({ tick: 0, jump: true }, { tick: 1, jump: false });
  test('nhảy 7 m/s, g = 20: đỉnh ≈ v²/2g = 1.225 m, chạm đất lại sau ≈ 0.7 s, không xuống dưới 0', () => {
    const r = run({ ticks: 60, scenario: base(), inputs: jump });
    const ys = r.snaps.map((s) => s.player.pos[1]);
    const peak = Math.max(...ys);
    assert.ok(peak > 1.2 && peak <= 1.225 + 1e-6, `peak=${peak}`);
    assert.ok(Math.min(...ys) >= 0);
    assert.equal(r.snapAt(10).player.grounded, false);
    assert.ok(r.snapAt(10).player.pos[1] > 0);
    near(r.snapAt(10).player.vel[1], 7 - 20 * 10 * STEP, 0.002);
    assert.equal(r.snapAt(45).player.pos[1], 0);
    assert.equal(r.snapAt(45).player.grounded, true);
  });
  test('chỉ nhảy khi chạm đất: bấm lại giữa không trung không nhảy đôi', () => {
    const twice = frames({ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 15, jump: true }, { tick: 16, jump: false });
    const r = run({ ticks: 60, scenario: base(), inputs: twice });
    assert.equal(r.snapAt(45).player.pos[1], 0);
    assert.ok(Math.max(...r.snaps.map((s) => s.player.pos[1])) <= 1.225 + 1e-6);
  });
  test('giữ phím nhảy liên tục chỉ nhảy 1 lần (cạnh false→true)', () => {
    const r = run({ ticks: 120, scenario: base(), inputs: frames({ tick: 0, jump: true }) });
    assert.equal(r.snapAt(60).player.pos[1], 0);
    assert.equal(r.snapAt(120).player.pos[1], 0);
  });
});

describe('lướt (dash)', () => {
  test('lướt 14 m/s trong 0.2 s (12 tick) = 2.8 m, ghi sự kiện dash {} ở tick 1', () => {
    const r = run({ ticks: 20, scenario: base(), inputs: frames({ tick: 0, dash: true }) });
    assert.deepEqual(r.ev('dash'), [{ type: 'event', tick: 1, name: 'dash', data: {} }]);
    near(r.snapAt(12).player.pos[2], 2.8); // đứng yên → hướng đang quay mặt = +Z
    near(r.snapAt(20).player.pos[2], 2.8); // hết lướt, không move → đứng lại
    near(r.snapAt(6).player.vel[2], 14);
  });
  test('đang di chuyển thì lướt theo hướng di chuyển; sau lướt chạy lại 6 m/s', () => {
    const r = run({ ticks: 30, scenario: base(), inputs: frames({ tick: 0, move: [1, 0] }, { tick: 5, dash: true }) });
    near(r.snapAt(5).player.pos[0], 0.5);
    near(r.snapAt(17).player.pos[0], 0.5 + 2.8); // 12 tick lướt (tick 6…17)
    near(r.snapAt(18).player.pos[0], 0.5 + 2.8 + 0.1);
    near(r.snapAt(17).player.pos[2], 0);
  });
  test('đứng yên sau khi chạy -X thì lướt về hướng Mây đang quay mặt (-X)', () => {
    const r = run({
      ticks: 60, scenario: base(),
      inputs: frames({ tick: 0, move: [-1, 0] }, { tick: 30, move: [0, 0] }, { tick: 31, dash: true }),
    });
    near(r.snapAt(31).player.pos[0], -3);
    near(r.snapAt(43).player.pos[0], -3 - 2.8);
  });
  test('hồi chiêu 1.5 s tính từ lúc bắt đầu: bấm lại ở tick 90 bị bỏ, ở tick 91 được', () => {
    const early = run({ ticks: 120, scenario: base(), inputs: frames({ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 89, dash: true }) });
    assert.deepEqual(early.ev('dash').map((e) => e.tick), [1]);
    const ok = run({ ticks: 120, scenario: base(), inputs: frames({ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 90, dash: true }) });
    assert.deepEqual(ok.ev('dash').map((e) => e.tick), [1, 91]);
    assert.equal(ok.snapAt(1).player.dash_cd_s, 1.5);
    assert.equal(ok.snapAt(46).player.dash_cd_s, 0.75);
    assert.equal(ok.snapAt(90).player.dash_cd_s, 0.017);
  });
  test('bấm lướt lại khi đang lướt (còn hồi chiêu) bị bỏ qua', () => {
    const r = run({
      ticks: 30, scenario: base(),
      inputs: frames({ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }),
    });
    assert.equal(r.ev('dash').length, 1);
  });
  test('lướt trên không giữ nguyên độ cao suốt 12 tick, rồi rơi tiếp từ vận tốc đứng 0', () => {
    const r = run({
      ticks: 50, scenario: base(),
      inputs: frames({ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, dash: true }),
    });
    const y10 = r.snapAt(10).player.pos[1];
    assert.ok(y10 > 0.5);
    for (let t = 11; t <= 22; t++) near(r.snapAt(t).player.pos[1], y10, 0.0011);
    assert.ok(r.snapAt(23).player.pos[1] < y10 - 0.001);
    assert.equal(r.snapAt(45).player.pos[1], 0);
  });
  test('không bất tử khi lướt: Bóng Mực chạm vẫn mất Ngọn Lửa', () => {
    const r = run({
      ticks: 5, scenario: base({ shades: [{ id: 'S1', pos: [0, 0, 0.9] }] }),
      inputs: frames({ tick: 0, dash: true }),
    });
    assert.deepEqual(r.ev('player_hit').map((e) => e.tick), [1]);
  });
  test('scenario dash_cd_ticks chặn lướt tới khi hết', () => {
    const r = run({ ticks: 70, scenario: base({ player: { dash_cd_ticks: 60 } }), inputs: frames({ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 59, dash: true }) });
    assert.equal(r.snapAt(0).player.dash_cd_s, 1);
    assert.deepEqual(r.ev('dash').map((e) => e.tick), [60]);
  });
});

describe('rơi khỏi đảo (Y < −10)', () => {
  const fallSc = (extra = {}) => base({ player: { pos: [0, -10.001, 50], ...extra } });

  test('đi ra mép bán kính 40: không rơi trước tick 400, rơi đúng 1 lần, -1 Ngọn Lửa', () => {
    const r = run({ ticks: 700, every: 1, scenario: base(), inputs: frames({ tick: 0, move: [1, 0] }) });
    const falls = r.ev('player_hit').filter((e) => e.data.by === 'fall');
    assert.equal(falls.length, 1);
    // chân ra khỏi đĩa ở tick 400 (n = 1); rơi tự do y = −10·(n/60)² chạm đúng −10 ở n = 60 (tick 459), nên < −10 ở tick 459–461
    assert.ok(falls[0].tick >= 459 && falls[0].tick <= 461, `rơi ở tick ${falls[0].tick}`);
    assert.deepEqual(falls[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 0 });
    for (const s of r.snaps.filter((x) => x.tick < 400)) assert.ok(s.player.pos[1] === 0);
    assert.equal(r.snapAt(falls[0].tick).player.flames, 2);
  });
  test('rơi: mất toàn bộ đom đóm (lost), bỏ qua bất tử, đúng 1 sự kiện', () => {
    const r = run({ ticks: 61, scenario: fallSc({ carried: 7, invuln_ticks: 500 }) });
    const falls = r.ev('player_hit');
    assert.deepEqual(falls.map((e) => [e.tick, e.data]), [[1, { by: 'fall', flames: 2, dropped: 0, lost: 7 }]]);
    assert.equal(r.snapAt(1).player.carried, 0);
    assert.equal(r.snapAt(1).player.flames, 2);
  });
  test('chờ 60 tick: đứng yên, không nhặt, không bị chạm; tick 61 hồi sinh ở (0,0,0), vận tốc 0, bất tử 90 tick', () => {
    // Mây rơi ở (30, -10.001, 0) (trên đĩa đảo nhưng đã chìm); đom đóm và Bóng Mực ở ngay cạnh, cùng độ cao
    const r = run({
      ticks: 160,
      scenario: base({ player: { pos: [30, -10.001, 0] }, motes: [[30, -10, 0]], shades: [{ id: 'S1', pos: [30.3, -10, 0] }] }),
    });
    for (const t of [1, 30, 60]) {
      const s = r.snapAt(t);
      assert.ok(s.player.pos[1] < -10, `tick ${t}`);
      assert.deepEqual([s.player.pos[0], s.player.pos[2]], [30, 0]);
      assert.deepEqual(s.player.vel, [0, 0, 0]);
      assert.equal(s.player.carried, 0, 'không nhặt trong lúc chờ');
      assert.equal(s.motes_active, 1);
    }
    assert.equal(r.ev('player_hit').length, 1, 'chỉ có sự kiện rơi, không bị Bóng Mực chạm trong lúc chờ');
    const s61 = r.snapAt(61);
    assert.deepEqual(s61.player.pos, [0, 0, 0]);
    assert.deepEqual(s61.player.vel, [0, 0, 0]);
    assert.equal(s61.player.grounded, true);
    assert.equal(s61.player.invuln, true);
    assert.equal(r.snapAt(150).player.invuln, true); // bộ đếm 90 đặt ở tick 61, hết ở tick 151
    assert.equal(r.snapAt(151).player.invuln, false);
    assert.equal(s61.player.flames, 2);
  });
  test('hết Ngọn Lửa vì rơi → thua ngay (no_flames), không hồi sinh', () => {
    const r = run({ ticks: 300, scenario: fallSc({ flames: 1 }) });
    assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [['player_hit', 1], ['game_over', 1]]);
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  });
  test('đĩa đảo chỉ ở Y = 0: đang lướt ra ngoài mép giữ độ cao 12 tick rồi mới rơi', () => {
    const r = run({
      ticks: 30, scenario: base({ player: { pos: [39.9, 0, 0] } }),
      inputs: frames({ tick: 0, move: [1, 0], dash: true }),
    });
    for (let t = 1; t <= 12; t++) assert.equal(r.snapAt(t).player.pos[1], 0);
    assert.ok(r.snapAt(14).player.pos[1] < 0);
    assert.equal(r.snapAt(14).player.grounded, false);
  });
});

describe('đom đóm: nhặt & sinh', () => {
  test('trong pickup_radius (đúng 1.0 m) → nhặt ở tick 1; nhặt KHÔNG cộng điểm', () => {
    const r = run({ scenario: base({ motes: [[0, 0, 1]] }) });
    assert.deepEqual(r.events, [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
    assert.equal(r.end.score, 0);
    assert.equal(r.snapAt(1).motes_active, 0);
  });
  test('ngoài pickup_radius (1.01 m) → không nhặt', () => {
    const r = run({ ticks: 5, scenario: base({ motes: [[0, 0, 1.01]] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(5).motes_active, 1);
  });
  test('chênh cao ≤ 1.5 m mới nhặt: mote ở y=1.5 nhặt được, y=1.51 thì không', () => {
    assert.equal(run({ ticks: 1, scenario: base({ motes: [[0, 1.5, 0.5]] }) }).ev('mote_picked').length, 1);
    assert.equal(run({ ticks: 1, scenario: base({ motes: [[0, 1.51, 0.5]] }) }).ev('mote_picked').length, 0);
  });
  test('đầy túi (carry_capacity 10) → không nhặt', () => {
    const r = run({ ticks: 5, scenario: base({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(5).motes_active, 1);
    assert.equal(r.snapAt(5).player.carried, 10);
  });
  test('còn chỗ 1 mà có 3 đom đóm gần → chỉ nhặt 1', () => {
    const r = run({ ticks: 5, scenario: base({ player: { carried: 9 }, motes: [[0, 0, 0.9], [0, 0, 0.5], [0.8, 0, 0]] }) });
    assert.equal(r.ev('mote_picked').length, 1);
    assert.equal(r.snapAt(5).player.carried, 10);
    assert.equal(r.snapAt(5).motes_active, 2);
  });
  test('nhặt gần nhất trước', () => {
    const r = run({ ticks: 1, scenario: base({ player: { carried: 9 }, motes: [[0, 0, 0.9], [0, 0, 0.5]] }) });
    assert.deepEqual(r.snapAt(1).motes.map((m) => m.id), ['M1']); // M2 (gần hơn) bị nhặt
  });
  test('20 đom đóm lúc đầu; sinh thêm 1 mỗi 240 tick ở điểm trống tới khi hết 24 điểm', () => {
    const r = run({ seed: 5, ticks: 1300, every: 1, scenario: { random_shades: false } });
    const n = (t) => r.snapAt(t).motes_active;
    assert.equal(n(0), 20);
    assert.equal(n(239), 20);
    assert.equal(n(240), 21);
    assert.equal(n(480), 22);
    assert.equal(n(720), 23);
    assert.equal(n(960), 24);
    assert.equal(n(1200), 24, 'hết điểm trống thì bỏ lượt');
    const keys = r.snapAt(1300).motes.map((m) => m.pos.join(','));
    assert.equal(new Set(keys).size, 24, '24 điểm khác nhau');
  });
  test('trần 30: có 30 đom đóm thì tick 240 không sinh thêm; có 29 thì lên 30', () => {
    const far = (n) => Array.from({ length: n }, (_, i) => [200 + i, 0, 0]);
    assert.equal(run({ ticks: 240, every: 240, scenario: { random_shades: false, motes: far(30) } }).snapAt(240).motes_active, 30);
    assert.equal(run({ ticks: 240, every: 240, scenario: { random_shades: false, motes: far(29) } }).snapAt(240).motes_active, 30);
  });
  test('random_motes:false tắt luôn việc sinh theo lịch', () => {
    const r = run({ ticks: 500, every: 250, scenario: { random_motes: false, random_shades: false } });
    assert.equal(r.snapAt(500).motes_active, 0);
  });
});

describe('nạp đèn', () => {
  const at = (carried, extra = {}) => base({ player: { pos: [0, 0, 23], carried }, ...extra }); // cách L1 đúng 2.0 m
  const press = frames({ tick: 0, interact: true });

  test('nạp hết carried khi chưa đủ cost 10; +5 điểm mỗi đom đóm nạp', () => {
    const r = run({ scenario: at(3), inputs: press });
    assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 3 });
    assert.equal(r.snapAt(1).player.carried, 0);
    assert.equal(r.ev('lantern_lit').length, 0);
    assert.equal(r.end.score, 15);
  });
  test('nạp nhiều lần: đèn nhớ tiến độ, đủ 10 thì thắp (+7×5 + 100)', () => {
    const r = run({ scenario: at(10, { lanterns: [{ id: 'L1', deposited: 3 }] }), inputs: press });
    assert.deepEqual(r.events.map((e) => e.name), ['deposit', 'lantern_lit']);
    assert.equal(r.events[0].data.amount, 7);
    assert.equal(r.snapAt(1).player.carried, 3);
    assert.equal(r.snapAt(1).lanterns[0].lit, true);
    assert.equal(r.end.score, 7 * 5 + 100);
  });
  test('ngoài interact_radius (2.01 m) → không nạp', () => {
    const r = run({ scenario: base({ player: { pos: [0, 0, 22.99], carried: 3 } }), inputs: press });
    assert.equal(r.events.length, 0);
  });
  test('[Ticket-03] đèn đã thắp nhận châm dầu (không còn "không nạp thêm"): hao 1/60 ở bước 2 nên cần 1 đom đóm', () => {
    const r = run({ scenario: at(5, { lanterns: [{ id: 'L1', lit: true }] }), inputs: press });
    assert.deepEqual(r.events.map((e) => [e.name, e.data]), [['refuel', { lantern_id: 'L1', amount: 1, fuel: 100 }]]);
    assert.equal(r.end.score, 5);
    assert.equal(r.snapAt(1).player.carried, 4);
  });
  test('[Ticket-03] đèn sáng gần hơn vẫn được chọn (nhận châm dầu) trước đèn tắt xa hơn', () => {
    const r = run({
      scenario: base({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0.5, 0, 0], lit: true }, { id: 'L2', pos: [1.5, 0, 0] }] }),
      inputs: press,
    });
    assert.equal(r.ev('deposit').length, 0);
    assert.equal(r.ev('refuel')[0].data.lantern_id, 'L1');
  });
  test('chọn đèn gần nhất; bằng nhau thì id nhỏ hơn', () => {
    const near2 = run({
      scenario: base({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }, { id: 'L2', pos: [0.5, 0, 0] }] }),
      inputs: press,
    });
    assert.equal(near2.ev('deposit')[0].data.lantern_id, 'L2');
    const tie = run({
      scenario: base({ player: { carried: 4 }, lanterns: [{ id: 'L3', pos: [-1, 0, 0] }, { id: 'L2', pos: [0, 0, 1] }] }),
      inputs: press,
    });
    assert.equal(tie.ev('deposit')[0].data.lantern_id, 'L2');
  });
  test('scenario đặt sẵn lit:true không phát sự kiện, không cộng điểm', () => {
    const r = run({ ticks: 0, scenario: base({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }) });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(0).score, 0);
    assert.equal(r.snapAt(0).lanterns[0].lit, true);
  });
  test('nút giữ (interact true liên tục) chỉ kích 1 lần ở cạnh false→true', () => {
    const r = run({ ticks: 30, scenario: at(2), inputs: press });
    assert.equal(r.ev('deposit').length, 1);
  });
});

describe('tỏa sáng', () => {
  const press = frames({ tick: 0, pulse: true });
  const sc = (shadeX, carried = 5, y = 0) => base({ player: { carried }, shades: [{ id: 'S1', pos: [shadeX, y, 0] }] });

  test('trừ 3 đom đóm, choáng, đẩy 4 m rải trong 15 tick, +5 điểm, hồi chiêu 3 s', () => {
    const r = run({ ticks: 20, scenario: sc(4.5), inputs: press });
    assert.deepEqual(r.ev('pulse')[0].data, { stunned_ids: ['S1'] });
    assert.equal(r.snapAt(1).player.carried, 2);
    assert.equal(r.snapAt(1).shades[0].state, 'stunned');
    assert.equal(r.snapAt(1).player.pulse_cd_s, 3);
    near(r.snapAt(1).shades[0].pos[0], 4.5 + 4 / 15);
    near(r.snapAt(15).shades[0].pos[0], 8.5);
    near(r.snapAt(20).shades[0].pos[0], 8.5);
    assert.equal(r.end.score, 5);
  });
  test('bán kính tính theo khoảng cách 3D từ chân + 0.8 m: 4.9 m trúng, 4.95 m trượt', () => {
    assert.deepEqual(run({ scenario: sc(4.9), inputs: press }).ev('pulse')[0].data.stunned_ids, ['S1']);
    assert.deepEqual(run({ scenario: sc(4.95), inputs: press }).ev('pulse')[0].data.stunned_ids, []);
  });
  test('3D thật: cách 4 m ngang nhưng cao 4.5 m thì trượt; cách 3 m ngang, cao 4.5 m thì trúng', () => {
    const at = (x) => run({ scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [x, 4.5, 0] }] }), inputs: press });
    assert.deepEqual(at(4).ev('pulse')[0].data.stunned_ids, []);
    assert.deepEqual(at(3).ev('pulse')[0].data.stunned_ids, ['S1']);
  });
  test('trượt: vẫn tốn 3 đom đóm và vào hồi chiêu', () => {
    const r = run({ scenario: sc(6.5), inputs: press });
    assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, []);
    assert.equal(r.snapAt(1).player.carried, 2);
    assert.equal(r.snapAt(1).shades[0].state, 'chase');
  });
  test('thiếu pulse_cost (carried 2) → không tỏa sáng', () => {
    const r = run({ scenario: sc(4, 2), inputs: press });
    assert.equal(r.events.length, 0);
    assert.equal(r.snapAt(1).player.carried, 2);
  });
  test('hồi chiêu 3 s: bấm ở tick 380 bị bỏ, ở tick 381 (= 201 + 180) được', () => {
    const mk = (k2) => run({
      ticks: 400, scenario: base({ player: { carried: 10 } }),
      inputs: frames({ tick: 200, pulse: true }, { tick: 201, pulse: false }, { tick: k2, pulse: true }),
    });
    assert.deepEqual(mk(379).ev('pulse').map((e) => e.tick), [201]);
    assert.deepEqual(mk(380).ev('pulse').map((e) => e.tick), [201, 381]);
    assert.equal(mk(380).snapAt(400).player.carried, 4);
  });
  test('đang choáng bị trúng lần nữa: vẫn nằm trong stunned_ids, +5 điểm nữa, làm mới 120 tick', () => {
    const r = run({
      ticks: 130,
      scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 0, 0], state: 'stunned', state_ticks_left: 100 }] }),
      inputs: press,
    });
    assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['S1']);
    assert.equal(r.snapAt(1).score, 5);
    assert.equal(r.snapAt(100).shades[0].state, 'stunned'); // không làm mới thì đã hết ở tick 100
    assert.equal(r.snapAt(120).shades[0].state, 'stunned');
    assert.notEqual(r.snapAt(121).shades[0].state, 'stunned');
  });
  test('mỗi con mỗi lần +5: 2 con trúng cùng lúc → +10', () => {
    const r = run({ scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [3, 0, 0] }, { id: 'S2', pos: [-3, 0, 0] }] }), inputs: press });
    assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['S1', 'S2']);
    assert.equal(r.end.score, 10);
  });
  test('giữ nút pulse liên tục chỉ tỏa sáng 1 lần', () => {
    const r = run({ ticks: 500, scenario: base({ player: { carried: 10 } }), inputs: press });
    assert.equal(r.ev('pulse').length, 1);
  });
  test('choáng 120 tick: stunned ở tick 1…120, tick 121 về chase; đứng yên khi choáng', () => {
    const r = run({ ticks: 125, scenario: sc(4.5), inputs: press });
    assert.equal(r.snapAt(120).shades[0].state, 'stunned');
    assert.equal(r.snapAt(121).shades[0].state, 'chase');
    near(r.snapAt(120).shades[0].pos[0], 8.5);
    near(r.snapAt(121).shades[0].pos[0], 8.5 - 4 * STEP);
  });
  test('trùng vị trí thì đẩy theo +X', () => {
    const r = run({ ticks: 15, scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [0, 0, 0] }] }), inputs: press });
    near(r.snapAt(15).shades[0].pos[0], 4);
    near(r.snapAt(15).shades[0].pos[2], 0);
  });
  test('đẩy lùi dừng khi gặp vật cản: mép đảo (40 m)', () => {
    const r = run({
      ticks: 20,
      scenario: base({ player: { pos: [35.5, 0, 0], carried: 5 }, shades: [{ id: 'S1', pos: [39, 0, 0] }] }),
      inputs: press,
    });
    assert.ok(r.snapAt(20).shades[0].pos[0] <= 40.0005);
    near(r.snapAt(20).shades[0].pos[0], 40);
  });
  test('đẩy lùi dừng khi gặp vật cản: vùng an toàn của đèn đã thắp', () => {
    const r = run({
      ticks: 20,
      scenario: base({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [3.5, 0, 0] }] }),
      inputs: press,
    });
    assert.ok(dist(r.snapAt(20).shades[0].pos, [10, 0, 0]) > 6);
    near(r.snapAt(20).shades[0].pos[0], 3.999);
  });
});

describe('Bóng Mực: trạng thái & di chuyển', () => {
  test('đuổi người chơi ở 4.0 m/s', () => {
    const r = run({ ticks: 60, scenario: base({ shades: [{ id: 'S1', pos: [10, 0, 0] }] }) });
    near(r.snapAt(60).shades[0].pos[0], 6);
  });
  test('phát hiện 12 m: wander → chase khi ≤ 12 m (đúng 12 thì chase, 12.01 thì không)', () => {
    const st = (x) => run({ ticks: 1, scenario: base({ shades: [{ pos: [x, 0, 0], state: 'wander' }] }) }).snapAt(1).shades[0].state;
    assert.equal(st(12), 'chase');
    assert.equal(st(12.01), 'wander');
  });
  test('bỏ đuổi 18 m: chase → wander khi > 18 m (đúng 18 thì còn chase); trong khoảng 12–18 giữ trạng thái cũ', () => {
    const st = (x, state) => run({ ticks: 1, scenario: base({ shades: [{ pos: [x, 0, 0], state }] }) }).snapAt(1).shades[0].state;
    assert.equal(st(18.05, 'chase'), 'wander'); // sau 1 tick đã di chuyển nhưng vẫn > 18 lúc xét
    assert.equal(st(17.9, 'chase'), 'chase');
    assert.equal(st(15, 'chase'), 'chase');
    assert.equal(st(15, 'wander'), 'wander');
  });
  test('wander: đi 2 m/s (không đuổi Mây), giữ y', () => {
    const r = run({ ticks: 31, scenario: base({ shades: [{ pos: [30, 1, 0], state: 'wander' }] }) });
    const [a, b] = [r.snapAt(10).shades[0].pos, r.snapAt(40 - 9).shades[0].pos];
    assert.equal(a[1], 1);
    near(dist(a, b), 2 * (21 / 60), 0.02); // cùng hướng tới một điểm đích: 21 tick × 2/60
  });
  test('tên trạng thái chỉ thuộc spawning, wander, chase, recoil, stunned', () => {
    const r = run({
      seed: 3, ticks: 1500, every: 5,
      scenario: { random_motes: false, player: { flames: 99, carried: 9 }, shades: [{ id: 'A', pos: [4, 0, 0] }, { id: 'B', pos: [25, 0, 0], state: 'wander' }] },
      inputs: frames({ tick: 100, pulse: true }, { tick: 101, pulse: false }),
    });
    const names = new Set(r.snaps.flatMap((s) => s.shades.map((x) => x.state)));
    for (const n of names) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(n), n);
    for (const n of ['spawning', 'wander', 'chase', 'recoil', 'stunned']) assert.ok(names.has(n), `chưa thấy trạng thái ${n}`);
  });
  test('scenario: state/state_ticks_left — stunned 120 tick mặc định, recoil đi xa Mây 2 m/60 tick, spawning 1 tick', () => {
    const st = run({ ticks: 125, scenario: base({ shades: [{ pos: [10, 0, 0], state: 'stunned' }] }) });
    assert.equal(st.snapAt(119).shades[0].state, 'stunned');
    assert.equal(st.snapAt(120).shades[0].state, 'chase');
    const rc = run({ ticks: 65, scenario: base({ shades: [{ pos: [3, 0, 0], state: 'recoil' }] }) });
    assert.equal(rc.snapAt(59).shades[0].state, 'recoil');
    assert.equal(rc.snapAt(60).shades[0].state, 'chase');
    near(rc.snapAt(60).shades[0].pos[0], 5);
    const sp = run({ ticks: 2, scenario: base({ shades: [{ pos: [10, 0, 0], state: 'spawning' }] }) });
    assert.equal(sp.snapAt(0).shades[0].state, 'spawning');
    assert.equal(sp.snapAt(1).shades[0].state, 'chase');
    const custom = run({ ticks: 12, scenario: base({ shades: [{ pos: [10, 0, 0], state: 'stunned', state_ticks_left: 5 }] }) });
    assert.equal(custom.snapAt(4).shades[0].state, 'stunned');
    assert.equal(custom.snapAt(5).shades[0].state, 'chase');
  });
});

describe('vùng an toàn', () => {
  test('chỉ đèn ĐÃ THẮP chặn ở mép 6 m: chưa thắp thì đi xuyên, đã thắp thì dừng ở 26.001', () => {
    const mk = (lit) => base({
      player: { pos: [10, 0, 0], flames: 99 },
      lanterns: [{ id: 'L1', pos: [20, 0, 0], lit }],
      shades: [{ id: 'S1', pos: [28, 0, 0] }],
    });
    const unlit = run({ ticks: 400, scenario: mk(false) });
    const lit = run({ ticks: 400, scenario: mk(true) });
    const L = [20, 0, 0];
    assert.ok(Math.min(...unlit.snaps.map((s) => dist(s.shades[0].pos, L))) < 6, 'đèn chưa thắp không chặn');
    for (const s of lit.snaps) assert.ok(dist(s.shades[0].pos, L) > 6, 'đèn đã thắp phải chặn');
    near(lit.snapAt(400).shades[0].pos[0], 26.001);
  });
  test('Bóng đang ở trong vùng khi đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick (0.2 m/tick) và không gây sát thương', () => {
    // đèn L1 (0,0,5) được thắp ở tick 1; Bóng ở (0,0,3.5) cách Mây (0,0,3) 0.5 m, cách đèn 1.5 m
    const r = run({
      ticks: 120, every: 1,
      scenario: base({ player: { pos: [0, 0, 3], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 5] }], shades: [{ id: 'S1', pos: [0, 0, 3.5] }] }),
      inputs: frames({ tick: 0, interact: true }),
    });
    assert.equal(r.ev('lantern_lit').length, 1);
    assert.equal(r.ev('player_hit').length, 0, 'trong lúc bị đẩy không gây sát thương');
    const L = [0, 0, 5];
    near(dist(r.snapAt(1).shades[0].pos, L), 1.5 + 0.2, 0.002);
    near(dist(r.snapAt(10).shades[0].pos, L), 1.5 + 2.0, 0.002);
    assert.ok(dist(r.snapAt(30).shades[0].pos, L) > 6, 'ra khỏi vùng trong ≤ 30 tick');
    for (const s of r.snaps) assert.ok(dist(s.shades[0].pos, L) >= 1.5);
  });
  test('Bóng ở trong vùng của đèn đặt sẵn lit (đẩy ra từ tick 1) không làm hại dù sát Mây', () => {
    const r = run({
      ticks: 200,
      scenario: base({ player: { pos: [2, 0, 0], flames: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [2.2, 0, 0] }] }),
    });
    assert.equal(r.ev('player_hit').length, 0);
    assert.ok(dist(r.snapAt(200).shades[0].pos, [0, 0, 0]) > 6);
  });
});

describe('sinh Bóng Mực theo lịch', () => {
  const sc = (extra = {}) => ({ random_motes: false, player: { flames: 999 }, ...extra });

  test('2 con ở tick 300 (S1,S2), rồi 1 con mỗi 480 tick (780, 1260…), tối đa 6', () => {
    const r = run({ ticks: 2800, every: 1, scenario: sc() });
    assert.deepEqual(r.ev('shade_spawned').map((e) => [e.tick, e.data.id]),
      [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
    assert.equal(r.snapAt(299).shades.length, 0, 'không có con nào trước tick 300');
    assert.equal(r.snapAt(2800).shades.length, 6);
  });
  test('con mới ở trạng thái spawning đúng tick sinh, rồi hoạt động từ tick sau', () => {
    const r = run({ ticks: 302, every: 1, scenario: sc() });
    assert.deepEqual(r.snapAt(300).shades.map((s) => s.state), ['spawning', 'spawning']);
    assert.ok(r.snapAt(301).shades.every((s) => s.state !== 'spawning'));
  });
  test('sinh trên 12 điểm bán kính 37 (15°, 45°, …), 2 con ở 2 điểm khác nhau, cách Mây ≥ 15 m', () => {
    const r = run({ seed: 2, ticks: 1300, every: 1, scenario: sc() });
    const spawn = (tick) => r.snapAt(tick).shades.filter((s) => s.state === 'spawning').map((s) => s.pos);
    for (const t of [300, 780, 1260]) {
      for (const p of spawn(t)) {
        near(Math.hypot(p[0], p[2]), 37, 0.002);
        const deg = ((Math.atan2(p[2], p[0]) * 180) / Math.PI + 360) % 360;
        const k = (deg - 15) / 30;
        near(k, Math.round(k), 0.001);
        assert.ok(dist(p, [0, 0, 0]) >= 15);
        assert.equal(p[1], 1);
      }
    }
    const [a, b] = spawn(300);
    assert.ok(dist(a, b) > 1);
  });
  test('điểm cách Mây < 15 m bị loại: Mây đứng ngay điểm 15° thì không con nào sinh ở đó (nhiều seed)', () => {
    const at = [37 * Math.cos(Math.PI / 12), 0, 37 * Math.sin(Math.PI / 12)];
    for (let seed = 1; seed <= 8; seed++) {
      const r = run({ seed, ticks: 300, every: 300, scenario: sc({ player: { pos: at, flames: 999 } }) });
      for (const s of r.snapAt(300).shades) assert.ok(dist(s.pos, at) >= 15, `seed ${seed}: ${s.id}`);
    }
  });
  test('điểm nằm trong vùng an toàn của đèn đã sáng bị loại', () => {
    const lanterns = [];
    const pts = Array.from({ length: 12 }, (_, i) => [37 * Math.cos(((15 + 30 * i) * Math.PI) / 180), 0, 37 * Math.sin(((15 + 30 * i) * Math.PI) / 180)]);
    [0, 1, 2, 3].forEach((i) => lanterns.push({ id: `L${i + 1}`, pos: pts[i], lit: true }));
    const r = run({ seed: 1, ticks: 300, every: 300, scenario: { random_motes: false, lanterns, player: { flames: 999 } } });
    for (const s of r.snapAt(300).shades) for (const i of [0, 1, 2, 3]) assert.ok(dist(s.pos, pts[i]) > 6, `${s.id} trong vùng an toàn của đèn ${i + 1}`);
    assert.equal(r.snapAt(300).shades.length, 2);
  });
  test('random_shades:false tắt luôn lịch sinh', () => {
    const r = run({ ticks: 1500, every: 500, scenario: base() });
    assert.equal(r.ev('shade_spawned').length, 0);
    assert.equal(r.snapAt(1500).shades.length, 0);
  });
});

describe('bị chạm', () => {
  test('mất 1 flame, đánh rơi floor(5×0.5)=2 đom đóm; chạm đầu tiên ở tick 8 (≤ 1 m)', () => {
    const r = run({ ticks: 12, scenario: base({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [1.5, 0, 0] }] }) });
    const hit = r.ev('player_hit')[0];
    assert.equal(hit.tick, 8); // 1.5 − 8×4/60 = 0.967 ≤ 1; bước 7: 1.033 > 1
    assert.deepEqual(hit.data, { by: 'shade', flames: 2, dropped: 2 });
    assert.equal(r.snapAt(8).player.carried, 3);
    assert.equal(r.snapAt(8).player.invuln, true);
  });
  test('đom đóm rơi: kind "dropped", vành 1.5–2.5 m quanh Mây, ttl 8 s; biến mất sau 480 tick', () => {
    const r = run({ ticks: 500, every: 1, scenario: base({ player: { carried: 5, flames: 9 }, shades: [{ id: 'S1', pos: [1.5, 0, 0] }] }) });
    const ms = r.snapAt(8).motes;
    assert.equal(ms.length, 2);
    for (const m of ms) {
      assert.equal(m.kind, 'dropped');
      assert.equal(m.ttl_s, 8);
      const d = dist(m.pos, [0, 0, 0]);
      assert.ok(d >= 1.5 - 0.002 && d <= 2.5 + 0.002, `d=${d}`);
    }
    assert.equal(r.snapAt(487).motes.filter((m) => m.kind === 'dropped').length >= 2, true);
    assert.equal(r.snapAt(488).motes.filter((m) => m.id === ms[0].id || m.id === ms[1].id).length, 0);
    near(r.snapAt(100).motes[0].ttl_s, (480 - 92) / 60, 0.02);
  });
  test('carried 1 → rơi floor(0.5) = 0', () => {
    const r = run({ ticks: 10, scenario: base({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.ev('player_hit')[0].data, { by: 'shade', flames: 2, dropped: 0 });
    assert.equal(r.snapAt(10).motes_active, 0);
  });
  test('bất tử 1.5 s: hai lần chạm cách nhau đúng 90 tick; bóng giật lùi 2 m trong 60 tick (recoil) rồi quay lại', () => {
    const r = run({ ticks: 100, every: 1, scenario: base({ player: { flames: 5 }, shades: [{ id: 'S1', pos: [1.5, 0, 0] }] }) });
    assert.deepEqual(r.ev('player_hit').map((e) => e.tick), [8, 98]);
    assert.deepEqual(r.ev('player_hit').map((e) => e.data.flames), [4, 3]);
    assert.equal(r.snapAt(8).shades[0].state, 'recoil');
    assert.equal(r.snapAt(67).shades[0].state, 'recoil');
    assert.equal(r.snapAt(68).shades[0].state, 'chase');
    near(r.snapAt(68).shades[0].pos[0] - r.snapAt(8).shades[0].pos[0], 2, 0.002);
  });
  test('bóng chạm lúc Mây bất tử không làm gì (không mất lửa, không giật lùi)', () => {
    const r = run({ ticks: 40, every: 1, scenario: base({ player: { invuln_ticks: 30 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.ev('player_hit').map((e) => e.tick), [30]);
    for (let t = 1; t < 30; t++) assert.equal(r.snapAt(t).shades[0].state, 'chase');
    assert.equal(r.snapAt(29).player.flames, 3);
  });
  test('tối đa 1 lần mất Ngọn Lửa mỗi tick: 2 con cùng chạm → chỉ 1 hit, con kia hit sau 90 tick', () => {
    const r = run({ ticks: 95, scenario: base({ shades: [{ id: 'S1', pos: [0.5, 0, 0] }, { id: 'S2', pos: [-0.5, 0, 0] }] }) });
    assert.deepEqual(r.ev('player_hit').map((e) => e.tick), [1, 91]);
    assert.equal(r.snapAt(1).player.flames, 2);
  });
  test('chênh cao ≤ 1.5 m mới chạm: bóng cao 2 m không chạm, cao 1.5 m thì chạm', () => {
    const hit = (y) => run({ ticks: 2, scenario: base({ shades: [{ pos: [0.5, y, 0] }] }) }).ev('player_hit').length;
    assert.equal(hit(2), 0);
    assert.equal(hit(1.5), 1);
  });
  test('Bóng Mực đang choáng không gây sát thương, dù Mây đi xuyên qua nó', () => {
    const r = run({
      ticks: 150, scenario: base({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [4, 0, 0] }] }),
      inputs: frames({ tick: 0, pulse: true, move: [1, 0] }),
    });
    assert.equal(r.ev('pulse')[0].data.stunned_ids[0], 'S1');
    assert.ok(r.snaps.some((s) => dist(s.shades[0].pos, s.player.pos) < 1 && s.shades[0].state === 'stunned'), 'phải có lúc đi qua trong 1 m');
    assert.equal(r.ev('player_hit').length, 0);
  });
});

describe('thắng / thua / điểm', () => {
  test('hết flames → thua no_flames, dừng ngay', () => {
    const r = run({ ticks: 600, scenario: base({ player: { flames: 1 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [['player_hit', 1], ['game_over', 1]]);
    assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  });
  test('hết Ngọn Lửa luôn thua, kể cả khi mọi đèn đã sáng cùng tick', () => {
    const all = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
    const r = run({ ticks: 5, scenario: base({ player: { flames: 1 }, lanterns: all, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }) });
    assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'lost', score: 0 });
  });
  test('hết giờ với 0 đèn sáng → thua dawn ở tick 60 khi time_left_s = 1', () => {
    const r = run({ ticks: 600, every: 60, scenario: base({ time_left_s: 1 }) });
    assert.deepEqual(r.ev('game_over'), [{ type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }]);
    assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
    assert.equal(r.snapAt(60).time_left_s, 0);
  });
  test('thắp đủ đèn KHÔNG kết thúc Đêm (không còn thắng sớm)', () => {
    const lit = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
    const r = run({
      ticks: 120, scenario: base({ player: { pos: [0, 0, 3], carried: 10 }, lanterns: [...lit, { id: 'L5', pos: [0, 0, 5] }], time_left_s: 100 }),
      inputs: frames({ tick: 0, interact: true }),
    });
    assert.deepEqual(r.events.map((e) => e.name), ['deposit', 'lantern_lit']);
    assert.equal(r.end.state, 'playing');
    assert.equal(r.end.ticks, 120);
  });
  test('điểm cộng dồn: nạp 7 đom đóm (+70) + thắp (+100) + 1 Bóng Mực trúng Tỏa Sáng (+5), cùng tick', () => {
    const r = run({
      ticks: 1,
      scenario: base({ player: { pos: [0, 0, 23], carried: 10 }, lanterns: [{ id: 'L1', deposited: 3 }], shades: [{ id: 'S1', pos: [0, 0, 20] }] }),
      inputs: frames({ tick: 0, interact: true, pulse: true }),
    });
    assert.equal(r.end.score, 7 * 5 + 100 + 5);
    assert.equal(r.snapAt(1).player.carried, 0);
  });
});

describe('tạm dừng (pause)', () => {
  const pauseAt = (...ticks) => ({ frames: ticks.flatMap((t) => [{ tick: t, pause: true }, { tick: t + 1, pause: false }]) });
  const withMove = (obj) => ({ frames: [{ tick: 0, move: [0, 1] }, ...obj.frames] });

  test('pause: tick vẫn tăng nhưng sim_tick, thời gian, vị trí đứng yên; snapshot state "paused"; sự kiện paused/resumed', () => {
    const r = run({ ticks: 130, every: 1, scenario: base(), inputs: withMove(pauseAt(10, 100)) });
    assert.deepEqual(r.ev('paused'), [{ type: 'event', tick: 11, name: 'paused', data: {} }]);
    assert.deepEqual(r.ev('resumed'), [{ type: 'event', tick: 101, name: 'resumed', data: {} }]);
    assert.equal(r.snapAt(10).state, 'playing');
    for (const t of [11, 50, 100]) {
      const s = r.snapAt(t);
      assert.equal(s.state, 'paused');
      assert.equal(s.sim_tick, 10);
      assert.equal(s.tick, t);
      assert.equal(s.time_left_s, r3(240 - 10 / 60));
      near(s.player.pos[2], 1.0);
    }
    const s101 = r.snapAt(101);
    assert.equal(s101.state, 'playing');
    assert.equal(s101.sim_tick, 11);
    near(s101.player.pos[2], 1.1);
    assert.equal(r.end.ticks, 130);
  });
  test('pause đóng băng hồi chiêu, Bóng Mực và lịch sinh: tạm dừng 400 tick thì lịch sinh lùi đúng 400 tick', () => {
    const r = run({
      ticks: 700, every: 1,
      scenario: { random_motes: false, player: { pulse_cd_ticks: 120, flames: 99 }, shades: [{ id: 'A', pos: [30, 0, 0], state: 'wander' }] },
      inputs: { frames: [{ tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 400, pause: true }, { tick: 401, pause: false }] },
    });
    const paused = r.snaps.filter((s) => s.state === 'paused');
    assert.equal(paused.length, 400); // tick 1…400
    assert.ok(paused.every((s) => s.sim_tick === 0 && s.player.pulse_cd_s === 2 && s.shades.length === 1));
    assert.ok(paused.every((s) => s.shades[0].pos.join() === '30,0,0'));
    assert.deepEqual(r.ev('shade_spawned').map((e) => e.tick), [700, 700]); // 300 + 400
  });
  test('nút khác bấm lúc tạm dừng bị bỏ qua; không đổi điểm/đom đóm', () => {
    const r = run({
      ticks: 30, scenario: base({ motes: [[0, 0, 0.5]] }),
      inputs: { frames: [{ tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 5, jump: true, dash: true, move: [1, 0] }] },
    });
    assert.ok(r.snaps.filter((s) => s.tick > 0).every((s) => s.state === 'paused'));
    assert.equal(r.ev('dash').length, 0);
    assert.equal(r.ev('mote_picked').length, 0);
    assert.deepEqual(r.snapAt(30).player.pos, [0, 0, 0]);
  });
  test('giữ pause liên tục chỉ bật 1 lần (cạnh false→true)', () => {
    const r = run({ ticks: 20, scenario: base(), inputs: { frames: [{ tick: 3, pause: true }] } });
    assert.equal(r.ev('paused').length, 1);
    assert.equal(r.ev('resumed').length, 0);
    assert.equal(r.snapAt(20).state, 'paused');
    assert.equal(r.end.state, 'playing');
  });
});

describe('snapshot & sự kiện v1.1', () => {
  test('night_start {night:1} ghi 1 lần ở tick 1, là sự kiện đầu tiên', () => {
    const r = run({ ticks: 100, scenario: base() });
    assert.deepEqual(r.ev('night_start'), [{ type: 'event', tick: 1, name: 'night_start', data: { night: 1 } }]);
    assert.equal(r.allEvents[0].name, 'night_start');
  });
  test('snapshot có đủ trường mới: night, wind, player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}, motes[].{kind, ttl_s}, drifters, charms', () => {
    const s = run({ ticks: 0, scenario: base({ motes: [[5, 0, 5]] }) }).snapAt(0);
    assert.equal(s.night, 1);
    assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
    assert.deepEqual(Object.keys(s.player).sort(), ['capacity', 'carried', 'charm_s', 'dash_cd_s', 'flames', 'grounded', 'invuln', 'pos', 'pulse_cd_s', 'vel']);
    assert.deepEqual(s.motes, [{ id: 'M1', pos: [5, 0, 5], kind: 'random', ttl_s: null }]);
    assert.deepEqual(s.drifters, []);
    assert.deepEqual(s.charms, []);
  });
  test('scenario player.{invuln_ticks, pulse_cd_ticks, charm_ticks} xuất hiện trong snapshot rồi đếm lùi 1 tick mỗi bước', () => {
    const r = run({ ticks: 61, every: 1, scenario: base({ player: { invuln_ticks: 30, pulse_cd_ticks: 120, charm_ticks: 90 } }) });
    const s0 = r.snapAt(0).player;
    assert.deepEqual([s0.invuln, s0.pulse_cd_s, s0.charm_s], [true, 2, 1.5]);
    near(r.snapAt(1).player.charm_s, 89 / 60, 0.001);
    assert.equal(r.snapAt(30).player.invuln, false);
    assert.equal(r.snapAt(29).player.invuln, true);
    assert.equal(r.snapAt(60).player.pulse_cd_s, 1);
    assert.equal(r.snapAt(60).player.charm_s, 0.5);
  });
  test('scenario nhận drifters/charms/random_drifters/wind_enabled (định dạng đúng) mà không lỗi', () => {
    const r = run({ ticks: 2, scenario: base({ drifters: [], charms: [], random_drifters: false, wind_enabled: false }) });
    assert.equal(r.code, 0);
  });
});

function r3(v) { return Math.round(v * 1000) / 1000; }
