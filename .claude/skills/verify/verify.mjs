// Chạy npm test, rồi headless 2 lần/Đêm cùng seed và so từng byte. Ghi bằng chứng vào docs/proof/phase2/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const seed = opt('seed', '1');
const ticks = opt('ticks', '3600');
const outDir = path.join(ROOT, 'docs', 'proof', 'phase2');
fs.mkdirSync(outDir, { recursive: true });

const report = [`# Verify report`, '', `seed ${seed}, ticks ${ticks}`, ''];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const t = spawnSync(npm, ['test'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
const tail = (t.stdout || '').split('\n').filter((l) => /^ℹ (tests|pass|fail|skipped)/.test(l)).join('\n');
report.push('## npm test', '', t.status === 0 ? 'XANH' : 'ĐỎ', '', '```', tail, '```', '');
let ok = t.status === 0;
if (!ok) process.stderr.write((t.stdout || '') + (t.stderr || ''));

const nights = ok ? [1] : [];
for (const n of nights) {
  const files = [1, 2].map((r) => path.join(outDir, `night${n}-run${r}.jsonl`));
  for (const f of files) {
    const r = spawnSync(process.execPath, ['src/headless.js', '--seed', seed, '--night', String(n),
      '--ticks', ticks, '--out', f, '--snapshot-every', '60'], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) { ok = false; report.push(`Đêm ${n}: headless lỗi mã ${r.status}: ${r.stderr}`); }
  }
  if (files.every((f) => fs.existsSync(f))) {
    const same = fs.readFileSync(files[0]).equals(fs.readFileSync(files[1]));
    if (!same) ok = false;
    const last = fs.readFileSync(files[0], 'utf8').trim().split('\n').at(-1);
    report.push(`## Đêm ${n}`, '', `- 2 lần chạy giống từng byte: ${same ? 'CÓ' : 'KHÔNG'}`, `- dòng end: \`${last}\``, '');
  }
}
report.push(`## Kết luận: ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
fs.writeFileSync(path.join(outDir, 'verify-report.md'), report.join('\n') + '\n');
console.log(report.join('\n'));
process.exit(ok ? 0 : 1);
