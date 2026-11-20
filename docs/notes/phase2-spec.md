# Phase 2 – Spec và acceptance criteria

Nguồn: docs/requirements/phase2-ticket-02.md (Contract v1.1). Luật chi tiết và giả định: docs/notes/assumptions.md ("Thay đổi Phase 2").
**Phạm vi đã chốt: K0 + K1.** Các mục Phần 3 còn lại để sau (ghi rõ ở từng mục).

## Đã làm (K1): số chuẩn + Contract v1.1 cho Đêm 1
| # | Mục | Acceptance criteria (đo bằng headless) | Test |
|---|---|---|---|
| 1 | Tuning chuẩn | `game.contract.json` v1.1 có đủ khóa (kể cả `dash_speed`, `dash_duration_s`, `dash_cooldown_s`, `night2_duration_s`, `night3_duration_s`), bằng số ở ticket, khớp `tuning.js` và bảng assumptions | contract.test.js · nhóm `game.contract.json` |
| 2 | Bản đồ Đêm 1 | 5 đèn đúng tọa độ ticket; 20 đom đóm ở 20 điểm khác nhau trong 24 điểm (8 r=12, 16 r=33); xuất phát (0,0,0) | contract.test.js · `thế giới mặc định` |
| 3 | Lịch đom đóm | +1 mỗi 240 tick ở điểm trống, dừng ở 24 điểm; trần 30; `random_motes:false` tắt | rules.test.js · `đom đóm: nhặt & sinh` |
| 4 | Nhặt | ≤ 1.0 m XZ và chênh cao ≤ 1.5; nhặt không cộng điểm | `đom đóm: nhặt & sinh` |
| 5 | Nạp đèn | cost 10, tầm 2.0 m, nạp min(mang, thiếu), +10/đom đóm, chọn đèn chưa sáng gần nhất (hòa → id nhỏ) | `nạp đèn` |
| 6 | Vùng an toàn | 6 m chặn ở 6.001; Bóng ở trong lúc đèn vừa thắp bị đẩy 0.2 m/tick, ra hết ≤ 30 tick, không sát thương | `vùng an toàn` |
| 7 | Tỏa Sáng | 3 đom đóm, 3D ≤ 5 m từ chân+0.8, choáng 120 tick, đẩy 4 m trong 15 tick, +5/con/lần, hồi 180 tick, dừng ở vật cản | `tỏa sáng` |
| 8 | Bóng Mực | 4 m/s; 12/18 m; trạng thái spawning/wander/chase/recoil/stunned; lịch 2 con ở tick 300 rồi mỗi 480 tick, tối đa 6, 12 điểm r=37, ≥ 15 m | `Bóng Mực: trạng thái & di chuyển`, `sinh Bóng Mực theo lịch` |
| 9 | Bị chạm + recoil | −1 lửa, rơi floor(mang/2) ra vành 1.5–2.5 m sống 480 tick, bất tử 90 tick, Bóng lùi 2 m/60 tick; Mây bất tử thì Bóng không làm gì; tối đa 1 hit/tick | `bị chạm` |
| 10 | Rơi khỏi đảo | Y < −10: đúng 1 lần, −1 lửa, mất hết đom đóm, bỏ qua bất tử; chờ 60 tick không nhặt/chạm; hồi sinh ở (0,0,0) bất tử 90 tick; hết lửa thì thua | `rơi khỏi đảo` |
| 11 | Nhảy, lướt | nhảy 7 m/s, g 20; lướt 14 m/s × 12 tick, hồi chiêu 90 tick từ lúc bắt đầu, giữ độ cao, không bất tử, hướng đang đi hoặc hướng quay mặt | `nhảy`, `lướt (dash)` |
| 12 | Thắng/thua/điểm | hết lửa luôn thua; đủ đèn thắng kể cả tick hết giờ; thắng: +2×floor(giây còn lại) + 50×lửa | `thắng / thua / điểm` |
| 13 | Pause | tick tăng, sim_tick/thời gian/hồi chiêu/spawn đứng yên, snapshot `paused`, sự kiện paused/resumed | `tạm dừng (pause)` |
| 14 | Trường mới v1.1 | snapshot (night, wind, player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s, motes kind/ttl_s, drifters, charms), scenario, input `dash`/`pause`, sự kiện dash/paused/resumed/night_start, player_hit do rơi có `lost` | `snapshot & sự kiện v1.1`, contract.test.js |
| 15 | Tất định | cùng seed + scenario + inputs → byte giống hệt (kể cả dash/pause/rơi) | determinism.test.js |

## Chưa làm (để sau, theo chỉ đạo "chỉ K0 + K1")
Mỗi mục dưới đây vẫn cần ít nhất 1 scenario headless khi làm. Acceptance criteria dự kiến:

- **K2 – Đêm 2/3:** `--night 2|3` chạy được; đèn/điểm sinh/độ dài Đêm (330/360 s) đúng ticket; cầu tre không lan can (rơi khi lệch z ∉ [−2,2]); bục nhảy bắn Y 14 / ngang 24 (Đêm 2), Y 12 / ngang 8 (Đêm 3) giữ tới khi chạm đất; 3 tầng Đêm 3, vách đứng, 2 dốc; tháp chuông không leo được; gió mạnh mỗi 30 s kéo 5 s, đẩy 2 m/s, báo trước 2 s; Bóng Mực Đêm 3 4.5 m/s, sinh mỗi 7 s / 6 s.
- **K3 – Gió Lạc:** 7 m/s, tối đa 2, sinh tick 1200, 2400…; idle→chase khi mang ≥ 5 và ≤ 15 m; cướp min(3, mang) khi XZ ≤ 1.2; flee 240 tick; Tỏa Sáng đổi trạng thái / thả đồ (biến mất sau 120 tick); không mất lửa; vùng an toàn không chặn. **Bùa Gió:** hiệu lực 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick, vị trí theo Đêm.
- **K4 – Hiệu năng:** 1 Đêm 21 600 tick headless ≤ 30 s; ghi kết quả đo + cấu hình máy.
- **K5 – Giao diện:** chuỗi 3 Đêm + menu, tạm dừng, cài đặt localStorage, HUD đủ, bảng màu chuẩn, ánh sáng 0.15 + 0.55×(sáng/tổng), âm thanh WebAudio, FPS ≥ 30 ở 1280×720. Hiện web vẫn là bản Phase 1 (chỉ vá để chạy với sim mới, chưa có dash/pause/HUD mới).
