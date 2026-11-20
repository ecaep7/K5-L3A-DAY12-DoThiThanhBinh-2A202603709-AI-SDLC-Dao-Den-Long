import { capacityOf, timeLeft, TUNING } from '../src/sim/index.js';

const $ = (id) => document.getElementById(id);
export const NIGHT_NAMES = { 1: 'Đảo Bến', 2: 'Đảo Cau', 3: 'Đảo Chuông' };
const REASON = {
  no_flames: 'Ngọn lửa của Mây đã tắt hết…',
  dawn: 'Bình minh tới mà số đèn sáng chưa đủ.',
};
let toastTimer = 0;
function cd(id, left, total) {
  const el = $(id);
  el.classList.toggle('ready', left <= 0);
  el.querySelector('i').style.height = `${Math.round((Math.max(0, left) / total) * 100)}%`;
}

// h: { start(mode), restart(), next(), menu() }
export function createHud(h) {
  $('restart').addEventListener('click', h.restart);
  $('next').addEventListener('click', h.next);
  $('tomenu').addEventListener('click', h.menu);
  $('p-resume').addEventListener('click', h.resume);
  $('p-restart').addEventListener('click', h.pauseRestart);
  $('p-menu').addEventListener('click', h.menu);
  const s = h.settings;
  for (const [id, key] of [['vol', 'volume'], ['sens', 'sens']]) {
    const el = $(id);
    el.value = s.get()[key];
    $(`${id}-v`).textContent = `${el.value}%`;
    el.addEventListener('input', () => { $(`${id}-v`).textContent = `${el.value}%`; s.set(key, Number(el.value)); });
  }
  $('p-settings').addEventListener('click', () => { $('settings').style.display = 'flex'; });
  $('s-done').addEventListener('click', () => { $('settings').style.display = 'none'; });
  for (const b of document.querySelectorAll('#menu button')) b.addEventListener('click', () => h.start(b.dataset.start));
  addEventListener('keydown', (e) => { if (e.code === 'Enter' && $('end').style.display === 'flex') h.restart(); });

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = 0; }, 1600);
  }

  return {
    toast,
    showPause(on) { $('pause').style.display = on ? 'flex' : 'none'; },
    showMenu(on) { $('menu').style.display = on ? 'flex' : 'none'; },
    onEvents(events) {
      for (const e of events) {
        if (e.name === 'lantern_lit') toast(`Đèn ${e.data.lantern_id} đã sáng!`);
        if (e.name === 'deposit') toast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id}`);
        if (e.name === 'refuel') toast(`Châm dầu ${e.data.lantern_id}: ${e.data.fuel}`);
        if (e.name === 'lantern_out') toast(`Đèn ${e.data.lantern_id} đã tắt!`);
        if (e.name === 'pulse') toast(e.data.stunned_ids.length ? 'Bóng Mực bị xua đi!' : 'Tỏa sáng!');
        if (e.name === 'shade_spawned') toast('Một Bóng Mực mới xuất hiện…');
        if (e.name === 'drifter_steal') toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`);
        if (e.name === 'drifter_drop') toast('Gió Lạc làm rơi đom đóm!');
        if (e.name === 'charm_picked') toast('Bùa Gió! Chạy nhanh, lướt không chờ');
        if (e.name === 'wind_warning') toast('Gió mạnh sắp thổi…');
        if (e.name === 'player_hit') {
          const el = $('hurt');
          el.style.opacity = 1;
          setTimeout(() => { el.style.opacity = 0; }, 350);
        }
      }
    },
    // ctx: { night, hasNext, chainTotal, chain }
    update(world, ctx) {
      const p = world.player;
      $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) || '–';
      const cap = capacityOf(p);
      $('carried').textContent = `${p.carried}/${cap}`;
      const on = Math.ceil((p.carried / cap) * 10); // thanh 10 ô, tỉ lệ theo sức chứa
      const cells = $('cells');
      if (cells.children.length !== 10) cells.innerHTML = '<div class="cell"></div>'.repeat(10);
      [...cells.children].forEach((c, i) => c.classList.toggle('on', i < on));
      cd('cd-dash', p.dashCd, Math.round(TUNING.dash_cooldown_s * 60));
      cd('cd-pulse', p.pulseCd, Math.round(TUNING.pulse_cooldown_s * 60));
      // nhắc nạp đèn khi đứng trong tầm tương tác
      let near = null;
      let nd = Infinity;
      for (const l of world.lanterns) {
        if (l.lit && l.fuel >= 100 * 60) continue;
        const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
        if (d <= TUNING.interact_radius && d < nd) { near = l; nd = d; }
      }
      const pr = $('prompt');
      pr.style.display = near && world.state === 'playing' ? 'block' : 'none';
      if (near) {
        const cost = near.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        pr.textContent = near.lit ? `E — Châm dầu (${Math.round(near.fuel / 60)}/100)` : `E — Nạp ánh sáng (${near.deposited}/${cost})`;
      }
      // mũi tên tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
      const ar = $('arrow');
      let target = null;
      let td = Infinity;
      for (const l of world.lanterns) {
        if (l.lit) continue;
        const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
        if (d < td) { target = l; td = d; }
      }
      const pj = target && ctx.project ? ctx.project(target.pos) : null;
      const offscreen = pj && (pj.behind || Math.abs(pj.x) > 0.95 || Math.abs(pj.y) > 0.9);
      if (offscreen && world.state === 'playing') {
        let dx = pj.behind ? -pj.x : pj.x;
        let dy = pj.behind ? -pj.y : pj.y;
        if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = -1;
        const k = 1 / Math.max(Math.abs(dx) / 0.9, Math.abs(dy) / 0.8);
        ar.style.display = 'block';
        ar.style.left = `calc(${50 + dx * k * 50}% - 17px)`;
        ar.style.top = `calc(${50 - dy * k * 50}% - 17px)`;
        ar.style.transform = `rotate(${Math.atan2(-dy, dx)}rad)`;
      } else {
        ar.style.display = 'none';
      }
      $('lit').textContent = `${world.lanterns.filter((l) => l.lit).length}/${world.lanterns.length}`;
      const tl = timeLeft(world);
      const t = Math.ceil(tl);
      $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      $('tc').classList.toggle('red', tl <= 30 && world.state === 'playing'); // đỏ + nhấp nháy khi còn ≤ 30 s
      $('nightname').textContent = `Đêm ${ctx.night} – ${NIGHT_NAMES[ctx.night]}`;
      $('score').textContent = world.score;
      const over = world.state !== 'playing';
      $('end').style.display = over ? 'flex' : 'none';
      if (over) {
        const won = world.state === 'won';
        const final = won && ctx.night === 3 && ctx.chain;
        $('end-title').textContent = final ? 'Bình Minh!' : won ? `Thắng Đêm ${ctx.night}!` : 'Thua rồi';
        const reason = won ? `Đảo vẫn sáng khi bình minh tới. ${NIGHT_NAMES[ctx.night]} ấm áp!` : (p.flames <= 0 ? REASON.no_flames : REASON.dawn);
        $('end-detail').textContent = `${reason} Điểm Đêm: ${world.score}${ctx.chain ? ` · Tổng: ${ctx.chainTotal}` : ''}`;
        $('next').style.display = won && ctx.hasNext ? '' : 'none';
      }
    },
  };
}
