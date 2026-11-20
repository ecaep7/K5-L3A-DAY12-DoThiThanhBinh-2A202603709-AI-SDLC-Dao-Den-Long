// src/sim phải thuần: không Three.js, không Math.random, không Date, không đồng hồ hệ thống.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.js';

const dir = path.join(ROOT, 'src', 'sim');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

const BANNED = [
  [/\bthree\b/i, 'three'],
  [/Math\.random/, 'Math.random'],
  [/\bDate\b/, 'Date'],
  [/performance\.now/, 'performance.now'],
  [/process\.hrtime/, 'process.hrtime'],
  [/crypto\.(getRandomValues|randomUUID|randomInt)/, 'crypto random'],
];

test('có file để quét', () => assert.ok(files.length >= 8));

for (const f of files) {
  test(`src/sim/${f} không dùng API cấm`, () => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const [re, name] of BANNED) assert.doesNotMatch(src, re, `${f} dùng ${name}`);
  });
}
