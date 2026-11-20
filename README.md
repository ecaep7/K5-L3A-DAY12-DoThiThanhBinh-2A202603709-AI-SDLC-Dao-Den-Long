# Đảo Đèn Lồng – Phase 1

Game 3D: Mây, người giữ đèn nhỏ tuổi, nhặt đom đóm, thắp 5 Đèn Lồng Lớn và xua Bóng Mực trước khi trời sáng (5 phút).

## Cài đặt và chạy (cần Node.js ≥ 20, macOS/Linux/Windows)
```
npm install
npm run dev          # mở http://localhost:5173
npm test             # chạy toàn bộ test
```
Headless (cho kiểm thử tự động, theo Test Contract v1.0):
```
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]
```
Mã thoát: 0 bình thường · 2 inputs/scenario sai định dạng · 1 lỗi khác. Cùng seed + scenario + inputs cho output giống hệt từng byte.

## Điều khiển
| Phím | Việc |
|---|---|
| WASD / mũi tên | đi (theo hướng camera) |
| Space | nhảy |
| E | nạp đom đóm vào đèn gần (trong 2.5 m) |
| F hoặc Shift trái | tỏa sáng (tốn 2 đom đóm) |
| kéo chuột trái | xoay camera |
| Enter | chơi lại khi ván kết thúc |

## Luật tóm tắt
Nhặt đom đóm tự động (tối đa 10). Đèn cần 5 đom đóm để thắp; đèn đã thắp tạo vùng an toàn 5 m mà Bóng Mực không vào được. Tỏa sáng làm Bóng Mực trong 6 m choáng 3 s và bị đẩy 4 m. Bị chạm: mất 1 lửa (có 3), đánh rơi một nửa đom đóm đang mang, bất tử 1.5 s. Thắng khi thắp đủ 5 đèn; thua khi hết lửa hoặc hết giờ. Chi tiết và các giả định: `docs/notes/assumptions.md`.

## Cách tính điểm
+10 mỗi đom đóm nhặt · +100 mỗi đèn thắp · +20 mỗi Bóng Mực bị choáng (chỉ khi chưa choáng) · khi thắng: +1 mỗi giây còn lại (làm tròn xuống) và +50 mỗi lửa còn lại.

## Cấu trúc
- `src/sim/`: logic thuần, tất định (PRNG có seed, không Three.js, không `Math.random`/`Date`).
- `src/headless.js`: CLI headless. `web/`: giao diện Three.js + Vite, dùng lại `src/sim`.
- `tests/`: node:test. `game.contract.json`: tuning khai báo cho giảng viên.
- `docs/`: giả định, nhật ký AI, truy vết luật → test (`docs/proof/traceability.md`).

## Ghi chú
- `game.contract.json`: mọi khái niệm trong tuning đều có trong game; `fall_enabled = false` (đảo có chắn mép nên không có sự kiện fall).
- Ở web, `?seed=123` chơi lại đúng một ván; `?freeze=1` chỉ vẽ không chạy sim (để chụp ảnh).
- Giao diện đã được kiểm bằng ảnh chụp Chrome headless; luật game được kiểm bằng headless + test, không phải bằng chơi tay.
