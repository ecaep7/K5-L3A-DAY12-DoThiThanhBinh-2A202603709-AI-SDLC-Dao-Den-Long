import { FormatError } from './errors.js';
import { SHADE_STATES } from './tuning.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function need(cond, msg) {
  if (!cond) throw new FormatError(`scenario: ${msg}`);
}

// Kiểm tra định dạng scenario (chưa biết id đèn; world.js kiểm id khi áp).
export function validateScenario(s) {
  need(isObj(s), 'phải là đối tượng JSON');
  if ('player' in s) {
    need(isObj(s.player), 'player phải là đối tượng');
    if ('pos' in s.player) need(isVec3(s.player.pos), 'player.pos phải là [x, y, z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      if (k in s.player) need(Number.isInteger(s.player[k]) && s.player[k] >= 0, `player.${k} phải là số nguyên >= 0`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (k in s) need(typeof s[k] === 'boolean', `${k} phải là boolean`);
  }
  if ('motes' in s) {
    need(Array.isArray(s.motes), 'motes phải là mảng');
    s.motes.forEach((m, i) => need(isVec3(m) || (isObj(m) && isVec3(m.pos)), `motes[${i}] phải là [x,y,z] hoặc {pos}`));
  }
  if ('shades' in s) {
    need(Array.isArray(s.shades), 'shades phải là mảng');
    s.shades.forEach((m, i) => {
      need(isObj(m) && isVec3(m.pos), `shades[${i}].pos phải là [x,y,z]`);
      if ('id' in m) need(typeof m.id === 'string' && m.id.length > 0, `shades[${i}].id phải là chuỗi`);
      if ('state' in m) need(SHADE_STATES.includes(m.state), `shades[${i}].state phải thuộc ${SHADE_STATES.join('|')}`);
      if ('target_lantern_id' in m) need(typeof m.target_lantern_id === 'string', `shades[${i}].target_lantern_id phải là chuỗi`);
      if ('state_ticks_left' in m) need(Number.isInteger(m.state_ticks_left) && m.state_ticks_left >= 0, `shades[${i}].state_ticks_left phải là số nguyên >= 0`);
    });
  }
  for (const k of ['drifters', 'charms']) {
    if (k in s) {
      need(Array.isArray(s[k]), `${k} phải là mảng`);
      s[k].forEach((m, i) => {
        need(isObj(m) && isVec3(m.pos), `${k}[${i}].pos phải là [x,y,z]`);
        if ('id' in m) need(typeof m.id === 'string' && m.id.length > 0, `${k}[${i}].id phải là chuỗi`);
      });
    }
  }
  (s.drifters ?? []).forEach((m, i) => {
    if ('state' in m) need(['idle', 'chase', 'flee'].includes(m.state), `drifters[${i}].state phải thuộc idle|chase|flee`);
    if ('stolen' in m) need(Number.isInteger(m.stolen) && m.stolen >= 0, `drifters[${i}].stolen phải là số nguyên >= 0`);
  });
  (s.charms ?? []).forEach((m, i) => {
    if ('available' in m) need(typeof m.available === 'boolean', `charms[${i}].available phải là boolean`);
    if ('respawn_ticks' in m) need(Number.isInteger(m.respawn_ticks) && m.respawn_ticks >= 0, `charms[${i}].respawn_ticks phải là số nguyên >= 0`);
  });
  if ('lanterns' in s) {
    need(Array.isArray(s.lanterns), 'lanterns phải là mảng');
    s.lanterns.forEach((l, i) => {
      need(isObj(l) && typeof l.id === 'string', `lanterns[${i}].id phải là chuỗi`);
      if ('pos' in l) need(isVec3(l.pos), `lanterns[${i}].pos phải là [x,y,z]`);
      if ('lit' in l) need(typeof l.lit === 'boolean', `lanterns[${i}].lit phải là boolean`);
      if ('fuel' in l) need(isNum(l.fuel) && l.fuel >= 0 && l.fuel <= 100, `lanterns[${i}].fuel phải là số trong [0, 100]`);
      if ('ever_lit' in l) need(typeof l.ever_lit === 'boolean', `lanterns[${i}].ever_lit phải là boolean`);
      if ('deposited' in l) need(Number.isInteger(l.deposited) && l.deposited >= 0, `lanterns[${i}].deposited phải là số nguyên >= 0`);
    });
  }
  if ('time_left_s' in s) need(isNum(s.time_left_s) && s.time_left_s >= 0, 'time_left_s phải là số >= 0');
  return s;
}
