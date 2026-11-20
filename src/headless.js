#!/usr/bin/env node
// CLI headless theo Test Contract v1.0.
// node src/headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out <f.jsonl> [--snapshot-every <int>=10]
import fs from 'node:fs';
import path from 'node:path';
import {
  createWorld, step, parseInputs, createInputTimeline, FormatError,
  snapshotLine, eventLine, endLine,
} from './sim/index.js';

const FLAGS = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);

class UsageError extends Error {}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (!m || !FLAGS.has(m[1])) throw new UsageError(`tham số không hợp lệ: ${argv[i]}`);
    if (i + 1 >= argv.length) throw new UsageError(`thiếu giá trị cho --${m[1]}`);
    a[m[1]] = argv[++i];
  }
  for (const k of ['seed', 'night', 'ticks', 'out']) {
    if (!(k in a)) throw new UsageError(`thiếu --${k}`);
  }
  const int = (name, v, min) => {
    if (!/^-?\d+$/.test(v) || Number(v) < min) throw new UsageError(`--${name} phải là số nguyên >= ${min}`);
    return Number(v);
  };
  const night = int('night', a.night, 1);
  if (night !== 1) throw new UsageError('chỉ hỗ trợ --night 1');
  return {
    seed: int('seed', a.seed, Number.MIN_SAFE_INTEGER),
    ticks: int('ticks', a.ticks, 0),
    every: 'snapshot-every' in a ? int('snapshot-every', a['snapshot-every'], 1) : 10,
    out: a.out,
    scenario: a.scenario,
    inputs: a.inputs,
  };
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new UsageError(`không đọc được file ${what}: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what} không phải JSON hợp lệ (${file}): ${e.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenario = args.scenario ? readJson(args.scenario, 'scenario') : null;
  const frames = args.inputs ? parseInputs(readJson(args.inputs, 'inputs')) : [];
  const world = createWorld(args.seed, scenario);
  const inputAt = createInputTimeline(frames);

  const lines = [snapshotLine(world)];
  for (let k = 0; k < args.ticks && world.state === 'playing'; k++) {
    for (const ev of step(world, inputAt(k))) lines.push(eventLine(ev));
    if (world.tick % args.every === 0) lines.push(snapshotLine(world));
  }
  lines.push(endLine(world));

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, lines.join('\n') + '\n');
}

try {
  main();
} catch (e) {
  process.stderr.write(`lỗi: ${e.message}\n`);
  process.exitCode = e instanceof FormatError ? 2 : 1;
}
