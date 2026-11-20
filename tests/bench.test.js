import test from 'node:test';
import assert from 'node:assert/strict';
import { metrics } from '../bench/bench.mjs';

// Kỳ vọng tính tay từ định nghĩa ở Ticket-04 mục 1.
test('bench metrics: 100 khung 10 ms → 100 fps, p1_low 100, p95 10', () => {
  const m = metrics(Array(100).fill(10));
  assert.equal(m.frames, 100);
  assert.equal(m.avg_fps, 100);
  assert.equal(m.p1_low_fps, 100);
  assert.equal(m.frame_ms_p95, 10);
});
test('bench metrics: p1_low lấy ceil(1%) khung chậm nhất', () => {
  const dts = [...Array(198).fill(10), 40, 20]; // N=200 → k=2 → (40+20)/2=30 ms → 33.33 fps
  const m = metrics(dts);
  assert.ok(Math.abs(m.p1_low_fps - 1000 / 30) < 1e-9);
  assert.ok(Math.abs(m.avg_fps - (1000 * 200) / (1980 + 60)) < 1e-9);
  assert.equal(m.frame_ms_p95, 10); // hạng 190 trong 200 giá trị đã sắp xếp
});
test('bench metrics: N nhỏ → k = 1 (khung chậm nhất)', () => {
  assert.equal(metrics([10, 50, 10]).p1_low_fps, 20);
});
