// Bàn phím + chuột → trạng thái input GIỮ cho sim. Nút bấm nhanh được "chốt" tới hết 1 bước sim.
const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], interact: ['KeyE'], pulse: ['KeyF', 'ShiftLeft'],
};

export function createInput(target) {
  const held = new Set();
  const latch = { jump: false, interact: false, pulse: false };
  let yaw = 0; // độ

  const actionOf = (code) => Object.keys(KEYS).find((a) => KEYS[a].includes(code));
  window.addEventListener('keydown', (e) => {
    const a = actionOf(e.code);
    if (!a) return;
    e.preventDefault();
    held.add(e.code);
    if (a in latch) latch[a] = true;
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointermove', (e) => {
    if (e.buttons & 1) yaw -= e.movementX * 0.4;
  });

  const isHeld = (a) => KEYS[a].some((k) => held.has(k));
  return {
    sample() {
      // camera nhìn theo (sinθ, cosθ) nên "phải" trên màn hình là x = −1 trong quy ước contract
      const x = (isHeld('left') ? 1 : 0) - (isHeld('right') ? 1 : 0);
      const z = (isHeld('up') ? 1 : 0) - (isHeld('down') ? 1 : 0);
      return {
        move: [x, z], cam_yaw_deg: yaw,
        jump: isHeld('jump') || latch.jump,
        interact: isHeld('interact') || latch.interact,
        pulse: isHeld('pulse') || latch.pulse,
      };
    },
    afterStep() { latch.jump = latch.interact = latch.pulse = false; },
    get yaw() { return yaw; },
  };
}
