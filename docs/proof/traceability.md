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
