import { capacityOf, timeLeft } from '../src/sim/index.js';

const $ = (id) => document.getElementById(id);
export const NIGHT_NAMES = { 1: 'Đảo Bến', 2: 'Đảo Cau', 3: 'Đảo Chuông' };
const REASON = {
  no_flames: 'Ngọn lửa của Mây đã tắt hết…',
  dawn: 'Bình minh tới mà số đèn sáng chưa đủ.',
};
let toastTimer = 0;

// h: { start(mode), restart(), next(), menu() }
export function createHud(h) {
  $('restart').addEventListener('click', h.restart);
  $('next').addEventListener('click', h.next);
  $('tomenu').addEventListener('click', h.menu);
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
      $('carried').textContent = `${p.carried}/${capacityOf(p)}`;
      $('lit').textContent = `${world.lanterns.filter((l) => l.lit).length}/${world.lanterns.length}`;
      const tl = timeLeft(world);
      const t = Math.ceil(tl);
      $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      $('timechip').classList.toggle('red', tl <= 30 && world.state === 'playing'); // đỏ khi còn ≤ 30 s
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
