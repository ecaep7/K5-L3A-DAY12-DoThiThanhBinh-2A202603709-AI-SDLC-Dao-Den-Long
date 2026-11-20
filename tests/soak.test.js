import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, writeTmp } from './helpers.js';

const SOAK = path.join(ROOT, 'src', 'soak.js');
const soak = (args) => spawnSync(process.execPath, [SOAK, ...args], { encoding: 'utf8' });

test('soak: 3 Đêm cho ra đúng khóa Ticket-04 mục 2, không crash', () => {
  const out = writeTmp('soak.json', '');
  const r = soak(['--seed', '7', '--nights', '3', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.nights, 3);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 3);
  assert.ok(j.results.every((x) => x === 'won' || x === 'lost'));
  assert.ok(j.mem_start_mb > 0 && j.mem_end_mb > 0 && j.duration_s >= 0);
});

test('soak: cùng seed cho cùng kết quả các Đêm', () => {
  const a = writeTmp('a.json', ''); const b = writeTmp('b.json', '');
  soak(['--seed', '7', '--nights', '4', '--out', a]); soak(['--seed', '7', '--nights', '4', '--out', b]);
  assert.deepEqual(JSON.parse(fs.readFileSync(a, 'utf8')).results, JSON.parse(fs.readFileSync(b, 'utf8')).results);
});

test('soak: thiếu --out hoặc --nights sai → mã thoát 2', () => {
  assert.equal(soak(['--seed', '7', '--nights', '3']).status, 2);
  assert.equal(soak(['--seed', '7', '--nights', '0', '--out', 'x.json']).status, 2);
});
