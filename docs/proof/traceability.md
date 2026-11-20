# Truy vết: luật → test

Tất cả test nằm trong `tests/`, chạy bằng `npm test` (node:test) qua CLI headless thật. Kỳ vọng tính từ `docs/notes/assumptions.md`, không chép từ output.

| Luật (assumptions.md) | Test (tests/rules.test.js trừ khi ghi khác) |
|---|---|
| Đảo tròn bán kính 40, không rơi, không sự kiện fall | `bị chặn ở mép đảo (bán kính 40), không có sự kiện fall` |
| 5 đèn cách đều vòng 25 m, L1 ở (0,0,25) | contract.test.js · `L1 ở (0,0,25); 5 đèn cách đều trên vòng 25 m` |
| 40 đom đóm theo seed; 3 Bóng Mực đầu ≥ 15 m | contract.test.js · `đom đóm nằm trong đảo…`, `seed khác → bố trí đom đóm khác` |
| Nhặt tự động trong pickup_radius, còn chỗ | `trong pickup_radius (đúng 1.5 m)`, `ngoài pickup_radius (1.51 m)`, `đầy túi`, `còn chỗ 1 mà có 3 đom đóm`, `nhặt gần nhất trước` |
| Nạp đèn: min(carried, cost − deposited); đủ thì thắp | `nạp hết carried…`, `nạp tối đa phần còn thiếu…`, `ngoài interact_radius`, `đèn đã thắp → không nạp thêm` |
| Tỏa sáng: trừ cost, choáng, đẩy, cooldown | `trừ 2 đom đóm, choáng, đẩy…`, `ngoài pulse_radius`, `thiếu pulse_cost`, `cooldown 1 s`, `choáng 3 s…` |
| Vùng an toàn chỉ đèn đã thắp | `vùng an toàn chỉ có ở đèn ĐÃ THẮP…` |
| Bị chạm: −1 flame, rơi floor(carried×0.5), bất tử 1.5 s, không chạm khi choáng | `mất 1 flame, đánh rơi…`, `bất tử 1.5 s…`, `Bóng Mực đang choáng không gây sát thương…` |
| Spawn 30 s/con, tối đa 6, ≥ 15 m | `Bóng Mực spawn ở tick 1800…`, `spawn mỗi 30 s, tối đa 6 con`, `random_shades:false tắt luôn spawn` |
| Thắng all_lit; thua no_flames; thua dawn | `thắp đủ 5 đèn → thắng`, `hết flames → thua`, `hết giờ → thua dawn` |
| Điểm: per_mote, per_lantern, per_stun, bonus thắng | `2 đom đóm → +20`, `nạp tối đa…(+100)`, `trừ 2 đom đóm…(+20)`, `pulse lên con đang choáng…`, `thắp đủ 5 đèn…` |
| Nhảy 6 m/s, trọng lực 20 | `nhảy: đỉnh ≈ v²/2g = 0.9 m…` |
| Di chuyển, chuẩn hóa, cam_yaw, giữ giá trị input | các test trong nhóm `di chuyển & nhảy` |
| Tuning khớp contract và assumptions | contract.test.js · nhóm `game.contract.json` |
| Tick model, JSONL, mã thoát 0/1/2 | contract.test.js · `tham số CLI & mô hình tick`, `mã thoát` |
| Tất định (cùng seed → giống từng byte) | determinism.test.js (3 cấu hình + seed khác thì khác) |
| `src/sim` thuần (không three, Math.random, Date) | purity.test.js |

## Phase 3 (Ticket-03, Contract v1.2) — `tests/fuel.test.js` trừ khi ghi khác

| Luật (assumptions.md, "Thay đổi Phase 3") | Test |
|---|---|
| Dầu hao 1/s, đơn vị nguyên, xuất 1 chữ số; scenario `lit` mặc định fuel 100, `ever_lit`, `fuel` | nhóm `nhiên liệu: hao và scenario` |
| Châm dầu: `used = min(mang, ceil((100−fuel)/10))`, +5/đom đóm, sự kiện `refuel`, chọn đèn gần nhất/id nhỏ | nhóm `châm dầu` · rules.test.js `[Ticket-03] đèn đã thắp nhận châm dầu…` |
| Hết dầu → `lantern_out`, `deposited 0`, `ever_lit`; thắp lại 5 đom đóm, +40, `relight`; chưa từng sáng vẫn 10 | nhóm `hết dầu và thắp lại` |
| Sức chứa `10 + 2×successful_lights` ≤ 20, nhặt theo sức chứa | nhóm `sức chứa tăng dần` · contract.test.js `người chơi ở (0,0,0)…` |
| Vùng an toàn theo `fuel ≥ 30` (đúng 30 còn), đẩy ra khi châm lên ≥ 30, không sát thương | nhóm `vùng an toàn theo fuel ≥ 30` |
| Bóng Mực `drain`: chọn đèn yếu, hút 5/s cộng dồn, `fuel_drain` mỗi 60 tick, các chuyển trạng thái, +15 điểm | nhóm `Bóng Mực drain` |
| Thắng `dawn_survived` ≥ ceil(0.6×tổng), thua `dawn`, `no_flames` thắng ở tick bình minh, không thắng sớm, điểm bình minh | nhóm `luật thắng dawn_survived` |
| Định dạng scenario v1.2 (mã thoát 2) | nhóm `định dạng scenario v1.2` |
| Tuning/contract v1.2 | contract.test.js · nhóm `game.contract.json` |
| Điểm +5/đom đóm nạp, thời lượng 240 s | rules.test.js · `nạp hết carried…`, `nạp nhiều lần…`, `điểm cộng dồn…`, `time_left_s = 240…` |

Kiểm tra test có thể đỏ (Phase 3): đổi `fuel >= FUEL.low` thành `>` trong `hasZone` → `tests/fuel.test.js` đỏ (1 test); đã hoàn nguyên, 168/168 xanh.

## Kiểm tra test có thể đỏ (đột biến tay)
15 đột biến luật/tuning (đổi `lantern_cost`, `pickup_radius`, bỏ cooldown, bỏ điều kiện stun/bất tử/vùng an toàn, bỏ cạnh nút, …), mỗi lần chạy `npm test`: **15/15 bị ít nhất 1 test bắt**. Lần đầu sót 1 (`per_stun` cho con đang choáng), đã thêm test rồi chạy lại.

## Giao diện
- `docs/proof/ui-start.png`: cảnh đầu ván (Chrome headless, `?seed=7&freeze=1`).
- Giao diện chỉ vẽ trạng thái của `src/sim`; luật được kiểm bằng headless ở trên.

## Phase 2 (K1) – số chuẩn Ticket-02, Contract v1.1
Bảng luật → test đầy đủ (15 mục, kèm tên nhóm test) ở `docs/notes/phase2-spec.md`; luật đổi so với Phase 1 và lý do sửa kỳ vọng test ở `docs/notes/assumptions.md` mục "Thay đổi Phase 2".

- `npm test`: 127 test, 0 đỏ (Phase 1 có 71; các test Phase 1 sai vì số mới đã sửa kỳ vọng, không xóa/skip).
- Đột biến tay (K1): đổi tỏa sáng thành 2D, cộng điểm khi nhặt, bỏ hồi chiêu lướt, cho Bóng trong vùng an toàn gây hại, rơi tôn trọng bất tử, thắng xét trước thua, đổi thời gian recoil → **7/7 bị ít nhất 1 test bắt**.
- `docs/proof/phase2/verify-report.md` + `night1-run1/2.jsonl`: chạy bằng skill `/verify` (tạo lại bằng lệnh, không sửa tay).
- Chưa làm: K2–K5 (xem phase2-spec.md).

## Phase 4 – Ticket-04, Contract v1.3
| Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| Mục 1 Bench: `bench_cmd`, cảnh chuẩn, chỉ số đúng định nghĩa | Đạt (tự đo) | `bench/bench.mjs`, `web/bench.js`; `bench.json` chạy thật (avg 103.7, p1_low 30, p95 16.8 ms, load 1.7 s); công thức: `tests/bench.test.js` |
| Bench: `peak_mem_mb` | Null có giải thích | bản web không đọc được RSS trình duyệt (trường `peak_mem_note`) |
| Bench: tắt vsync | Một phần | cờ Chromium đã đặt; không kiểm chứng được GPU có tôn trọng không |
| Mục 2 Soak: `soak_cmd`, crashes = 0, mem_end ≤ 1.2×mem_start | Đạt (số liệu) | `src/soak.js`, `soak.json` (46.9 → 51.6 MB, 0 crash); `tests/soak.test.js` |
| Soak: xoay vòng Đêm 1→2→3 | **Chưa đạt** | Đêm 2/3 chưa làm; mọi Đêm chạy bản đồ Đêm 1 (ghi trong `soak.json`) |
| Mục 3 Bảng xếp hạng, `--export-leaderboard` | **Chưa đạt** | không làm theo chỉ đạo Phase 4 (cũng cần màn Bình Minh Đêm 3) |
| Mục 4 Accessibility | **Chưa đạt** | không làm theo chỉ đạo Phase 4 |
| Gió Lạc, Bùa Gió | **Chưa đạt** | không làm theo chỉ đạo Phase 4 |
| Đêm 2, Đêm 3 (R5) | **Chưa đạt** | hết thời gian; `maps.js` chỉ có Đêm 1 |
| Mục 5 README, CHANGELOG 4 phase, CREDITS, LICENSE, bản web tĩnh .zip | Đạt (zip ở `release/`, không commit) | `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE` |
| Mục 6 Contract v1.3 (`bench_cmd`, `soak_cmd`) | Đạt | `game.contract.json`; `tests/contract.test.js` |
| Mục 7 Retro, video demo, GitHub Release v1.0.0, tag `phase-4` | **Chưa đạt** | tác giả tự làm |

`npm test`: 174 test, 0 đỏ (Phase 3 có 168; thêm 3 soak, 3 bench).
