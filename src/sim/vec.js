// Khoảng cách "trong bán kính" đo trên mặt phẳng XZ, nghĩa là ≤ r.
const EPS = 1e-9;

export function dist2D(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function within(a, b, r) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz <= r * r + EPS;
}

// Kẹp điểm vào hình tròn tâm (0,0) bán kính r (chỉ đổi x, z).
export function clampToDisc(pos, r) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > r) {
    pos[0] = (pos[0] / d) * r;
    pos[2] = (pos[2] / d) * r;
  }
}

// Hướng đơn vị XZ từ a tới b; trùng vị trí thì +X.
export function dirXZ(a, b) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d];
}
