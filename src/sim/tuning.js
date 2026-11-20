// Nguồn duy nhất của các số tuning (số chuẩn Ticket-02). Phải khớp game.contract.json (có test kiểm).
export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  score: Object.freeze({
    per_mote: 5, // mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu)
    per_lantern: 100, // thắp lần đầu
    per_relight: 40, // thắp lại
    per_stun: 5, // mỗi Bóng Mực trúng Tỏa Sáng
    per_stun_drain: 15, // tổng nếu ngay trước đó nó đang drain
    per_lit_at_dawn: 50, // + floor(fuel), mỗi đèn sáng lúc thắng
    per_flame_left: 50,
  }),
});

// Dầu tính theo đơn vị nguyên 1/60 (1 tick hao 1 đơn vị): 100 dầu = 6000 đơn vị.
export const FUEL = Object.freeze({
  unit: 60,
  max: 100 * 60,
  low: 30 * 60,
  perMote: 10 * 60,
  drainPerTick: 5, // drain_per_s 5/s = 5/60 dầu/tick = 5 đơn vị
  decayPerTick: 1,
});

// Hằng số của màn / vật lý (không nằm trong contract).
export const WORLD = Object.freeze({
  tick_hz: 60,
  island_radius: 40,
  jump_speed: 7,
  gravity: 20,
  fall_y: -10,
  fall_wait_ticks: 60,
  respawn_invuln_ticks: 90,
  mote_initial: 20,
  mote_max: 30,
  mote_every_ticks: 240,
  mote_ttl_ticks: 480,
  drop_ring_min: 1.5,
  drop_ring_max: 2.5,
  pulse_center_y: 0.8,
  pulse_stun_ticks: 120,
  pulse_push_ticks: 15,
  shade_y: 1,
  shade_detect: 12,
  shade_giveup: 18,
  shade_wander_speed: 2,
  shade_wander_retarget_ticks: 240,
  shade_min_spawn_dist: 15,
  shade_spawn_first_tick: 300,
  shade_spawn_first_count: 2,
  shade_spawn_every_ticks: 480,
  shade_max: 6,
  shade_spawn_radius: 37,
  recoil_m: 2,
  recoil_ticks: 60,
  hit_height: 1.5,
  pickup_height: 1.5,
  safe_push_ticks: 30,
  capacity_step: 2,
  step_up: 0.2, // bậc cao tối đa đi lên được khi đang đứng đất (dốc)
  drain_range: 2, // Bóng Mực cách đèn yếu ≤ 2 m (XZ) thì chuyển sang drain
  drain_chase_range: 6, // Mây vào trong 6 m thì drain → chase
  drain_event_ticks: 60,
  safe_margin: 0.001, // Bóng Mực bị đẩy ra ngoài safe_radius + margin (để dist > safe_radius)
});

export const SHADE_STATES = Object.freeze(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
