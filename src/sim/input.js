import { FormatError } from './errors.js';

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Kiểm tra file inputs, trả về mảng frame đã chuẩn hóa.
export function parseInputs(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.frames)) {
    throw new FormatError('inputs: cần đối tượng có mảng "frames"');
  }
  let last = -1;
  return obj.frames.map((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (f === null || typeof f !== 'object' || Array.isArray(f)) throw new FormatError(`${where}: phải là đối tượng`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`${where}.tick: phải là số nguyên >= 0`);
    if (f.tick <= last) throw new FormatError(`${where}.tick: phải tăng nghiêm ngặt`);
    last = f.tick;
    const out = { tick: f.tick };
    if ('move' in f) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)
          || f.move.some((x) => x < -1 || x > 1)) {
        throw new FormatError(`${where}.move: phải là [x, z], mỗi số trong [-1, 1]`);
      }
      out.move = [f.move[0], f.move[1]];
    }
    if ('cam_yaw_deg' in f) {
      if (!isNum(f.cam_yaw_deg)) throw new FormatError(`${where}.cam_yaw_deg: phải là số`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of BUTTONS) {
      if (b in f) {
        if (typeof f[b] !== 'boolean') throw new FormatError(`${where}.${b}: phải là boolean`);
        out[b] = f[b];
      }
    }
    return out;
  });
}

// Trả về hàm at(k) cho trạng thái input (giữ nguyên) ở tick k. Gọi với k tăng dần.
export function createInputTimeline(frames) {
  const state = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let idx = 0;
  return function at(k) {
    while (idx < frames.length && frames[idx].tick <= k) {
      const { tick, ...fields } = frames[idx++];
      Object.assign(state, fields);
    }
    return state;
  };
}
