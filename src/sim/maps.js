// Bản đồ chuẩn (Ticket-02 Phần 2). Góc đo từ +X, tăng dần về phía +Z: (r·cosθ, r·sinθ) trên (X, Z).
const ring = (r, startDeg, stepDeg, count) => Array.from({ length: count }, (_, i) => {
  const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
  return [r * Math.cos(a), 0, r * Math.sin(a)];
});

// Đêm 1 – Đảo Bến.
export const NIGHT1 = Object.freeze({
  night: 1,
  durationKey: 'night1_duration_s',
  islandRadius: 40,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12),
});

export function getMap(night) {
  if (night === 1) return NIGHT1;
  throw new Error(`Đêm ${night} chưa được hỗ trợ (K2 sẽ thêm Đêm 2, 3)`);
}
