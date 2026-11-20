import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADLESS = path.join(ROOT, 'src', 'headless.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
let counter = 0;

export function writeTmp(name, content) {
  const f = path.join(TMP, `${counter++}-${name}`);
  fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content));
  return f;
}

// Chạy CLI headless thật qua tiến trình con. Trả về mã thoát, stderr và output đã phân tích.
export function runCli(args) {
  const r = spawnSync(process.execPath, [HEADLESS, ...args], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}

// Chạy một ván. scenario/inputs là đối tượng JS (được ghi ra file tạm).
export function run({ seed = 1, ticks = 1, every = 1, scenario, inputs, raw } = {}) {
  const out = path.join(TMP, `${counter++}-out.jsonl`);
  const args = ['--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out,
    '--snapshot-every', String(every)];
  if (scenario !== undefined) args.push('--scenario', writeTmp('scenario.json', raw?.scenario ?? scenario));
  if (inputs !== undefined) args.push('--inputs', writeTmp('inputs.json', raw?.inputs ?? inputs));
  const { code, stderr } = runCli(args);
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const lines = text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const events = lines.filter((l) => l.type === 'event');
  const snaps = lines.filter((l) => l.type === 'snapshot');
  return {
    code, stderr, text, out, lines, events, snaps,
    end: lines.at(-1),
    snapAt: (t) => snaps.find((s) => s.tick === t),
    ev: (name) => events.filter((e) => e.name === name),
  };
}

// Scenario trống: không đom đóm, không Bóng Mực ngẫu nhiên.
export const base = (extra = {}) => ({
  random_motes: false, random_shades: false, motes: [], shades: [], ...extra,
});

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
