#!/usr/bin/env node
// Soak test theo Ticket-04 mục 2 (Contract v1.3).
// node src/soak.js --seed 7 --nights 10 --out soak.json
// Chạy headless N Đêm liên tiếp trong cùng một tiến trình. Đêm i (i = 1..N) dùng seed + i.
// Đêm xoay vòng 1 → 2 → 3 nhưng chỉ các Đêm đã hỗ trợ (src/sim/maps.js) mới được xoay.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { createWorld, step, mulberry32, TUNING } from './sim/index.js';
import { getMap } from './sim/maps.js';

class UsageError extends Error {}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--(seed|nights|out)$/.exec(argv[i]);
    if (!m) throw new UsageError(`tham số không hợp lệ: ${argv[i]}`);
    if (i + 1 >= argv.length) throw new UsageError(`thiếu giá trị cho --${m[1]}`);
    a[m[1]] = argv[++i];
  }
  for (const k of ['seed', 'nights', 'out']) if (!(k in a)) throw new UsageError(`thiếu --${k}`);
  if (!/^-?\d+$/.test(a.seed)) throw new UsageError('--seed phải là số nguyên');
  if (!/^\d+$/.test(a.nights) || Number(a.nights) < 1) throw new UsageError('--nights phải là số nguyên >= 1');
  return { seed: Number(a.seed), nights: Number(a.nights), out: a.out };
}

// Các Đêm đang hỗ trợ, theo thứ tự xoay vòng.
function supportedNights() {
  const list = [];
  for (const n of [1, 2, 3]) {
    try { getMap(n); list.push(n); } catch { /* chưa hỗ trợ */ }
  }
  return list;
}

// Ép GC trước mỗi lần đo RSS (hai đầu đo đối xứng) để RSS phản ánh rò rỉ thật, không phải rác chưa dọn.
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
const rssMb = () => (gc(), Math.round((process.memoryUsage().rss / 1048576) * 10) / 10);

// Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
function makeInput(rng) {
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  return (k) => {
    if (k % 30 === 0) {
      const ang = rng() * Math.PI * 2;
      input.move = [Math.cos(ang), Math.sin(ang)];
    }
    input.jump = rng() < 0.05;
    input.dash = rng() < 0.03;
    input.pulse = rng() < 0.02;
    input.interact = rng() < 0.1;
    return input;
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rotation = supportedNights();
  const t0 = process.hrtime.bigint();
  const results = [];
  let crashes = 0;
  let memStart = null;

  for (let i = 1; i <= args.nights; i++) {
    const night = rotation[(i - 1) % rotation.length];
    const seed = args.seed + i;
    try {
      const world = createWorld(seed, null, night);
      if (memStart === null) memStart = rssMb(); // sau khi tải xong Đêm đầu tiên
      const inputAt = makeInput(mulberry32(seed));
      const maxTicks = Math.ceil(TUNING[`night${night}_duration_s`] * 60) + 60;
      for (let k = 0; k < maxTicks && world.state === 'playing'; k++) step(world, inputAt(k));
      results.push(world.state === 'playing' ? 'lost' : world.state);
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`Đêm ${i} lỗi: ${e.message}\n`);
    }
  }

  const memEnd = rssMb(); // sau khi reset xong Đêm cuối (world của Đêm cuối đã ra khỏi phạm vi)
  const out = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStart ?? memEnd,
    mem_end_mb: memEnd,
    duration_s: Math.round((Number(process.hrtime.bigint() - t0) / 1e9) * 10) / 10,
    nights_rotation: rotation,
    note: rotation.length < 3
      ? 'Chưa đạt phần xoay vòng: mới có Đêm ' + rotation.join(', ') + ' (Đêm 2/3 chưa làm), nên mọi Đêm chạy bản đồ Đêm 1.'
      : 'Xoay vòng đủ Đêm 1 → 2 → 3.',
  };
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(out) + '\n');
  if (crashes > 0) process.exitCode = 1;
}

try {
  main();
} catch (e) {
  process.stderr.write(`lỗi: ${e.message}\n`);
  process.exitCode = e instanceof UsageError ? 2 : 1;
}
