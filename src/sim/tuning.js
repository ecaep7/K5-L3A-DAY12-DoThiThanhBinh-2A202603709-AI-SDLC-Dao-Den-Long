// Nguồn duy nhất của các số tuning. Phải khớp game.contract.json (có test kiểm).
export const TUNING = Object.freeze({
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: Object.freeze({
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 1,
    per_flame_left: 50,
  }),
});

// Hằng số của màn / vật lý (không nằm trong contract).
export const WORLD = Object.freeze({
  tick_hz: 60,
  island_radius: 40,
  lantern_ring_radius: 25,
  mote_count: 40,
  mote_spawn_radius: 38,
  shade_initial: 3,
  shade_max: 6,
  shade_spawn_every_s: 30,
  shade_min_spawn_dist: 15,
  shade_y: 1.0,
  jump_speed: 6,
  gravity: 20,
  safe_margin: 0.001, // Bóng Mực bị đẩy ra ngoài safe_radius + margin (để dist > safe_radius)
});
