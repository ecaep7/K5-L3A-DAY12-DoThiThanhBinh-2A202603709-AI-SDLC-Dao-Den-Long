// Tính tất định: cùng seed + scenario + inputs → hai file output giống nhau từng byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runCli, writeTmp } from './helpers.js';

function once(seed, ticks, scenario, inputs) {
  const out = writeTmp('det.jsonl', '');
  const args = ['--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', '5'];
  if (scenario) args.push('--scenario', writeTmp('s.json', scenario));
  if (inputs) args.push('--inputs', writeTmp('i.json', inputs));
  assert.equal(runCli(args).code, 0);
  return fs.readFileSync(out);
}

const walk = { frames: [
  { tick: 0, move: [1, 0.5] }, { tick: 100, jump: true, move: [-1, 0] }, { tick: 101, jump: false },
  { tick: 200, interact: true, pulse: true }, { tick: 201, interact: false, pulse: false },
  { tick: 600, move: [0, -1], cam_yaw_deg: 45 },
] };
const spawny = { random_motes: true, random_shades: true, player: { flames: 50, carried: 6 } };

for (const [name, seed, ticks, sc, inp] of [
  ['mặc định, seed 7, 6000 tick', 7, 6000, null, null],
  ['có inputs dài', 11, 4000, null, walk],
  ['scenario sinh Bóng Mực qua mốc 1800/3600', 5, 4000, spawny, walk],
]) {
  test(`chạy 2 lần giống hệt từng byte: ${name}`, () => {
    const a = once(seed, ticks, sc, inp);
    const b = once(seed, ticks, sc, inp);
    assert.ok(a.length > 1000);
    assert.ok(a.equals(b));
  });
}

test('seed khác → output khác (chống test luôn đạt)', () => {
  assert.ok(!once(7, 600, null, null).equals(once(8, 600, null, null)));
});
