import { capacityOf, timeLeft } from '../src/sim/index.js';

const $ = (id) => document.getElementById(id);
const REASON = {
  dawn_survived: 'Đảo vẫn sáng khi bình minh tới. Đảo Bến lại ấm áp!',
  no_flames: 'Ngọn lửa của Mây đã tắt hết…',
  dawn: 'Bình minh tới mà số đèn sáng chưa đủ.',
};
let toastTimer = 0;

export function createHud(onRestart) {
  $('restart').addEventListener('click', onRestart);
  addEventListener('keydown', (e) => { if (e.code === 'Enter' && $('end').style.display === 'flex') onRestart(); });

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = 0; }, 1600);
  }

  return {
    onEvents(events) {
      for (const e of events) {
        if (e.name === 'lantern_lit') toast(`Đèn ${e.data.lantern_id} đã sáng!`);
        if (e.name === 'deposit') toast(`Nạp ${e.data.amount} đom đóm vào ${e.data.lantern_id}`);
        if (e.name === 'pulse') toast(e.data.stunned_ids.length ? 'Bóng Mực bị xua đi!' : 'Tỏa sáng!');
        if (e.name === 'shade_spawned') toast('Một Bóng Mực mới xuất hiện…');
        if (e.name === 'player_hit') {
          const h = $('hurt');
          h.style.opacity = 1;
          setTimeout(() => { h.style.opacity = 0; }, 350);
        }
      }
    },
    update(world) {
      const p = world.player;
      $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) || '–';
      $('carried').textContent = `${p.carried}/${capacityOf(p)}`;
      $('lit').textContent = `${world.lanterns.filter((l) => l.lit).length}/${world.lanterns.length}`;
      const t = Math.ceil(timeLeft(world));
      $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      $('score').textContent = world.score;
      const over = world.state !== 'playing';
      $('end').style.display = over ? 'flex' : 'none';
      if (over) {
        $('end-title').textContent = world.state === 'won' ? 'Thắng rồi!' : 'Thua rồi';
        const reason = world.state === 'won' ? REASON.dawn_survived : (p.flames <= 0 ? REASON.no_flames : REASON.dawn);
        $('end-detail').textContent = `${reason} Điểm: ${world.score}`;
      }
    },
  };
}
