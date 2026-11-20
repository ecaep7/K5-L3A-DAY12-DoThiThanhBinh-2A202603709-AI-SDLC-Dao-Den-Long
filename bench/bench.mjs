#!/usr/bin/env node
// bench_cmd (Ticket-04 mục 1): node bench/bench.mjs --seed 42 --duration 30 --out bench.json
// Mở Chrome/Chromium 1280x720 (có cửa sổ, không toàn màn hình) qua Playwright, chạy web/bench.html, tính chỉ số.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const T_START = Date.now(); // mốc bắt đầu tiến trình (cho load_ms)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

function parseArgs(argv) {
  const a = { seed: '42', duration: '30' };
  for (let i = 0; i < argv.length; i += 2) {
    const m = /^--(seed|duration|out)$/.exec(argv[i]);
    if (!m || i + 1 >= argv.length) { console.error(`tham số không hợp lệ: ${argv[i]}`); process.exit(2); }
    a[m[1]] = argv[i + 1];
  }
  if (!a.out || !/^\d+$/.test(a.seed) || !(Number(a.duration) > 0)) { console.error('cần --out, --seed nguyên, --duration > 0'); process.exit(2); }
  return a;
}

// Chỉ số theo định nghĩa của ticket. dts: thời gian từng khung (ms).
export function metrics(dts) {
  const n = dts.length;
  const sum = dts.reduce((x, y) => x + y, 0);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = [...dts].sort((x, y) => y - x).slice(0, k);
  const sorted = [...dts].sort((x, y) => x - y);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)]; // nearest-rank
  return { frames: n, avg_fps: (1000 * n) / sum, p1_low_fps: 1000 / (worst.reduce((x, y) => x + y, 0) / k), frame_ms_p95: p95 };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' }).end(fs.readFileSync(p));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(DIST, 'bench.html'))) {
    const b = spawnSync('npm', ['run', 'build:web'], { cwd: ROOT, stdio: 'inherit', shell: true });
    if (b.status !== 0) throw new Error('build:web lỗi');
  }
  const { chromium } = await import('playwright');
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/bench.html?seed=${args.seed}&duration=${args.duration}`;
  // Tắt giới hạn 60 fps/vsync của Chromium; cửa sổ thường 1280x720.
  const flags = ['--disable-frame-rate-limit', '--disable-gpu-vsync', '--window-size=1280,720', '--ignore-gpu-blocklist'];
  let browser;
  try {
    browser = await chromium.launch({ headless: false, channel: 'chrome', args: flags });
  } catch {
    browser = await chromium.launch({ headless: false, args: flags }); // Chromium đi kèm Playwright
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const T = Date.now();
    page.on('crash', () => console.error(`trang bị crash sau ${Date.now() - T} ms`));
    page.on('close', () => console.error(`trang đóng sau ${Date.now() - T} ms`));
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    await page.goto(url);
    await page.waitForFunction('window.__bench && window.__bench.done', null, { timeout: (Number(args.duration) + 120) * 1000, polling: 500 });
    const data = await page.evaluate(() => ({
      dts: window.__bench.dts, firstFrameAt: window.__bench.firstFrameAt, gpu: window.__bench.info().gpu,
      dpr: devicePixelRatio, size: [innerWidth, innerHeight],
    }));
    const m = metrics(data.dts);
    const r1 = (x) => Math.round(x * 10) / 10;
    const out = {
      contract_version: '1.3',
      avg_fps: r1(m.avg_fps),
      p1_low_fps: r1(m.p1_low_fps),
      frame_ms_p95: r1(m.frame_ms_p95),
      frames: m.frames,
      load_ms: Math.round(data.firstFrameAt - T_START),
      peak_mem_mb: null,
      peak_mem_note: 'Bản web chạy trong trình duyệt: trang không đọc được RSS của tiến trình trình duyệt, nên không đo (null).',
      vsync_off: true,
      vsync_note: 'Chromium chạy với --disable-frame-rate-limit --disable-gpu-vsync; một số GPU/trình điều khiển/chế độ cửa sổ vẫn có thể ép vsync, xem avg_fps.',
      renderer: `three@0.170 WebGLRenderer, Chrome/Chromium ${browser.version()}, GPU: ${data.gpu}`,
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      window: data.size,
      device_pixel_ratio: data.dpr,
    };
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(out));
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`lỗi: ${e.message}`); process.exit(1); });
}
