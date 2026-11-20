// Âm thanh tự sinh bằng WebAudio (không có file âm thanh). Chỉ nghe: không ảnh hưởng sim.
const NOTES = [220, 261.63, 293.66, 329.63, 392, 440]; // gam ngũ cung A, nhạc nền nhẹ

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = 0;
  let volume = 0.6;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch { ctx = null; return false; }
    return true;
  }

  // freq (Hz), dur (s), kiểu sóng, độ to, tần số trượt tới, trễ bắt đầu (s)
  function tone(freq, dur, type = 'sine', gain = 0.25, slideTo = null, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const sfx = {
    pickup: () => tone(880, 0.09, 'sine', 0.18, 1320),
    lit: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, null, i * 0.09)),
    pulse: () => tone(300, 0.4, 'sine', 0.3, 900),
    hit: () => tone(140, 0.35, 'sawtooth', 0.3, 50),
    jump: () => tone(330, 0.15, 'square', 0.1, 600),
    dash: () => tone(500, 0.18, 'sawtooth', 0.1, 150),
    win: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.5, 'triangle', 0.25, null, i * 0.12)),
    lose: () => [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.55, 'sine', 0.28, null, i * 0.2)),
    shade: () => tone(110, 0.6, 'sine', 0.3, 70),
    tick: () => tone(1000, 0.08, 'square', 0.12),
    charm: () => tone(700, 0.25, 'triangle', 0.2, 1400),
    steal: () => tone(600, 0.3, 'sawtooth', 0.12, 200),
  };

  function startMusic() {
    if (musicTimer || !ensure()) return;
    const play = () => {
      const f = NOTES[Math.floor(Math.random() * NOTES.length)]; // âm nhạc chỉ ở lớp web: được dùng Math.random
      tone(f / 2, 3.2, 'sine', 0.07);
      if (Math.random() < 0.6) tone(f, 2.4, 'sine', 0.04, null, 0.8);
    };
    play();
    musicTimer = setInterval(play, 2200);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
    sfx,
    onEvents(events) {
      for (const e of events) {
        if (e.name === 'mote_picked') sfx.pickup();
        else if (e.name === 'lantern_lit') sfx.lit();
        else if (e.name === 'pulse') sfx.pulse();
        else if (e.name === 'player_hit') sfx.hit();
        else if (e.name === 'dash') sfx.dash();
        else if (e.name === 'shade_spawned') sfx.shade();
        else if (e.name === 'charm_picked') sfx.charm();
        else if (e.name === 'drifter_steal') sfx.steal();
        else if (e.name === 'game_over') (e.data.result === 'won' ? sfx.win : sfx.lose)();
      }
    },
  };
}
