# Giả định – Phase 1 + Phase 2 (K1)

Phần dưới "Thay đổi Phase 2" mô tả luật hiện hành; các mục cũ của Phase 1 có chỗ đã bị thay (xem bảng thay đổi).

## Công nghệ
- Node.js + Three.js (Vite) cho bản có giao diện. Logic game viết JS thuần, không phụ thuộc Three.js, để chạy headless bằng `node` trên macOS/Linux/Windows.

## Bản đồ Đêm 1 – Đảo Bến
- Đảo tròn bán kính 40 m, tâm (0,0,0). Người chơi bị chặn ở mép đảo, không rơi được → fall_enabled = false, không có sự kiện fall.
- 5 đèn L1–L5 cách đều trên vòng tròn bán kính 25 m; L1 ở (0,0,25).
- 40 đom đóm sinh ngẫu nhiên theo seed lúc bắt đầu, không sinh lại.
- 3 Bóng Mực lúc đầu; mỗi 30 s sinh thêm 1 (tối đa 6), cách người chơi ≥ 15 m. Id theo thứ tự S1, S2, …

## Luật
- Nhặt: tự động khi trong pickup_radius và carried < carry_capacity.
- Nạp đèn: nhấn interact trong interact_radius của đèn chưa thắp → nạp min(carried, lantern_cost − deposited). Đủ lantern_cost thì đèn thắp.
- Tỏa sáng: nhấn pulse khi carried ≥ pulse_cost và hết cooldown → trừ pulse_cost đom đóm; Bóng Mực trong pulse_radius bị choáng pulse_stun_s giây và bị đẩy ra xa pulse_push_m mét.
- Vùng an toàn: chỉ đèn ĐÃ THẮP mới có safe_radius; Bóng Mực không vào được.
- Bị chạm: khoảng cách ≤ shade_hit_radius, Bóng Mực không bị choáng, người chơi không đang bất tử → mất 1 flame, đánh rơi floor(carried × hit_drop_ratio) đom đóm (biến mất), bất tử invuln_s giây.
- Thắng: thắp đủ 5 đèn (all_lit). Thua: hết flames (no_flames) hoặc hết giờ (dawn).
- Nhảy: vận tốc 6 m/s, trọng lực 20 m/s².

## Điểm
- +per_mote mỗi đom đóm nhặt, +per_lantern mỗi đèn thắp, +per_stun mỗi Bóng Mực bị choáng.
- Khi thắng: + per_second_left × số giây còn lại (làm tròn xuống) + per_flame_left × flames còn lại.

## Tuning (số chuẩn Ticket-02 / Contract v1.1)
| Tham số | Giá trị | Tham số | Giá trị |
|---|---|---|---|
| player_speed | 6 | pulse_stun_s | 2 |
| carry_capacity | 10 | pulse_push_m | 4 |
| lantern_cost | 10 | pulse_cooldown_s | 3 |
| lantern_count_night1 | 5 | safe_radius | 6 |
| pickup_radius | 1 | shade_speed | 4 |
| interact_radius | 2 | shade_hit_radius | 1 |
| pulse_cost | 3 | fall_enabled | true |
| pulse_radius | 5 | night1_duration_s | 300 |
| flames | 3 | night2_duration_s | 330 |
| invuln_s | 1.5 | night3_duration_s | 360 |
| hit_drop_ratio | 0.5 | dash_speed | 14 |
| dash_duration_s | 0.2 | dash_cooldown_s | 1.5 |
| score.per_mote 10 · per_lantern 100 · per_stun 5 · per_second_left 2 · per_flame_left 50 | | | |

## Quyết định bổ sung khi cài đặt (PRD-0 còn mơ hồ)
1. **Thứ tự trong 1 bước (tick k→k+1):** áp input → di chuyển/nhảy/chặn mép → giảm timer → nhặt đom đóm → interact (nạp đèn) → pulse → Bóng Mực (di chuyển, rồi spawn) → bị chạm → kết thúc. Kết thúc xét theo thứ tự: thắng (`all_lit`) → `no_flames` → `dawn` (tick ≥ thời lượng × 60).
2. **Pulse:** mọi Bóng Mực trong pulse_radius vào `stunned_ids` (kể cả con đang choáng, được gia hạn). `per_stun` chỉ cộng cho con chưa choáng. Pulse không trúng ai vẫn trừ đom đóm và ghi sự kiện với mảng rỗng. Bị đẩy theo hướng từ người chơi, kẹp trong đảo và ngoài vùng an toàn. Choáng đúng 180 bước; cooldown 60 bước.
3. **Nhặt:** nhặt con gần nhất trước, tới khi đầy túi; mỗi con 1 sự kiện `mote_picked`.
4. **Nạp đèn:** nếu `min(carried, lantern_cost − deposited) = 0` thì không ghi sự kiện. Đủ cost → `lantern_lit` ngay sau `deposit`. Chỉ nạp cho đèn chưa thắp gần nhất trong interact_radius.
5. **Bóng Mực:** đi thẳng tới người chơi trên XZ, y = 1.0. Vùng an toàn: bị đẩy ra mép `safe_radius + 0.001` (để khoảng cách luôn > safe_radius sau khi làm tròn). Spawn ở tick 1800, 3600, 5400 (tối đa 6 con), cách người chơi ≥ 15 m, trong đảo, ngoài vùng an toàn; spawn sau khi các con cũ đã di chuyển. `random_shades:false` tắt cả spawn.
6. **Bị chạm:** mỗi bước tối đa 1 lần chạm. Bất tử 90 bước nên 2 lần chạm liên tiếp cách nhau đúng 90 tick.
7. **Scenario:** đèn L2–L5 mặc định cách đều 72° trên vòng 25 m. `lanterns[].id` không thuộc L1–L5 → lỗi định dạng (mã thoát 2). `lit:true` giữ `deposited` như cho (mặc định 0). `time_left_s` của scenario là thời lượng của đêm đó.
8. **Mã thoát:** 0 bình thường · 2 inputs/scenario sai định dạng (JSON hỏng, tick không tăng, `move` ngoài [−1,1], sai kiểu) · 1 lỗi khác (thiếu tham số, không đọc được file).
9. **Thứ tự dòng output:** sự kiện của bước ghi trước, rồi snapshot nếu `tick % snapshot-every == 0`. Snapshot có thêm `motes:[{id,pos}]` (khuyến nghị v1.0). PRNG `mulberry32(seed)`, thứ tự gọi: đom đóm → Bóng Mực ban đầu → spawn.
10. **Nhảy:** tích phân chính xác `y += v·dt − ½g·dt²` nên đỉnh ≈ 0.9 m (v²/2g).

## Thay đổi Phase 2
Luật hiện hành = Ticket-02 Phần 1–2 + các giả định bên dưới. Nếu mục cũ ở trên mâu thuẫn thì mục này thắng.

### Số liệu và luật thay đổi (kèm lý do sửa test)
| Phase 1 | Phase 2 | Test bị sửa kỳ vọng |
|---|---|---|
| lantern_cost 5, pickup 1.5, interact 2.5 | 10, 1.0, 2.0 | nhặt/nạp: đổi khoảng cách biên, lượng nạp |
| pulse 2 đom đóm / bán kính 6 / choáng 3 s / hồi 1 s | 3 / 5 (khoảng cách 3D từ chân+0.8 m) / 2 s = 120 tick / 3 s = 180 tick | nhóm "tỏa sáng": mục tiêu đặt ở 4.5 m vì 5 m ngang cho khoảng cách 3D = 5.064 > 5 |
| đẩy lùi tức thì 4 m | đẩy 4 m rải đều trong 15 tick đầu của choáng | test vị trí sau choáng |
| per_stun 20, chỉ con chưa choáng | per_stun 5, mỗi con mỗi lần (kể cả đang choáng) | test "pulse lên con đang choáng" |
| +10 khi nhặt | +10 khi NẠP (mỗi đom đóm nạp); nhặt không cộng điểm | test nhặt (điểm 0) và nạp (+10×amount) |
| thắng +1×giây + 50×lửa | +2×floor(giây còn lại) + 50×lửa | test thắng |
| Bóng Mực 3.5 m/s, safe_radius 5 | 4 m/s, 6 m (và tầm phát hiện 12 / bỏ đuổi 18) | test đuổi, vùng an toàn (đèn chặn ở 26.001 thay vì 25.001) |
| Bóng Mực mặc định 3 con, sinh mỗi 30 s | 0 con lúc đầu; 2 con ở tick 300, rồi 1 con mỗi 480 tick, tối đa 6; ở 12 điểm bán kính 37 | test spawn (id S1,S2 ở tick 300; S3 ở 780…) |
| 40 đom đóm ngẫu nhiên | 20 đom đóm ở 20 trong 24 điểm cố định, +1 mỗi 240 tick (trần 30) | test thế giới mặc định |
| 5 đèn trên vòng 25 m | tọa độ chuẩn của ticket | test vị trí đèn |
| bị chặn ở mép đảo, không rơi | rơi khi Y < −10 (fall_enabled true) | test "bị chặn ở mép" → test rơi |
| nhảy 6 m/s | 7 m/s, đỉnh v²/2g = 1.225 m | test nhảy |
| bị chạm: đom đóm rơi biến mất | rơi ra vành 1.5–2.5 m, sống 480 tick, nhặt lại được; Bóng giật lùi 2 m/60 tick | test bị chạm |
| Bóng Mực đang bất tử bị chạm vẫn đẩy | Mây bất tử: Bóng không làm gì (không giật lùi) | test bất tử |
| scenario shade mặc định `chase` nhưng đứng ngoài 18 m vẫn đuổi | quy tắc 12/18: ngoài 18 m → `wander` ngay tick đầu | các test đặt Bóng Mực xa Mây (đổi vị trí vào trong 18 m) |

### Thứ tự xử lý trong tick (bắt buộc, theo ticket)
1. Input (xử lý `pause` trước; vừa tạm dừng thì dừng bước). 2. Giảm bộ đếm (hồi chiêu, bất tử, choáng, spawning, bùa, TTL đom đóm, chờ hồi sinh). 3. Di chuyển Mây (hồi sinh, lướt, chạy, nhảy) rồi kiểm tra rơi. 4. Nhặt đom đóm. 5. Nạp đèn. 6. Vùng an toàn (đẩy Bóng đang ở trong). 7. Tỏa Sáng. 8. Di chuyển Bóng Mực. 9. Chạm. 10. Sinh theo lịch. 11. Thắng/thua. 12. Snapshot nếu tới lượt (headless). Giảm bộ đếm trước nên hồi chiêu đặt ở tick t cho phép dùng lại đúng ở tick t + cooldown.

### Giả định cho chỗ ticket mơ hồ
- **Góc:** vị trí = (r·cosθ, r·sinθ) trên (X, Z), θ tăng từ +X về phía +Z. Phù hợp ticket Đêm 3 (tầng 1 "nửa z > 0" có điểm sinh ở 20°…160°).
- **Chọn điểm sinh:** dùng PRNG có seed. Đom đóm ban đầu: xáo một phần 24 điểm, lấy 20, id M1… theo thứ tự điểm. Điểm trống = không có đom đóm ngẫu nhiên nào đang ở điểm đó. Điểm Bóng Mực hợp lệ = cách Mây ≥ 15 m (XZ), ngoài vùng an toàn, chưa có Bóng Mực trong 0.5 m. Chọn đều trong các điểm hợp lệ.
- **Trần 30** của đom đóm tính cả đom đóm rơi. Sinh theo lịch dùng `sim_tick` (đứng yên khi tạm dừng).
- **Lịch Bóng Mực:** `random_shades:false` tắt luôn lịch. Tick 300 sinh 2 con (S1, S2), sau đó mỗi 480 tick 1 con tới khi đủ 6 con đang có.
- **Trạng thái Bóng Mực:** `spawning` kéo dài đúng 1 tick (tick sinh; tick kế tiếp đã hoạt động). `wander`: đi tới điểm ngẫu nhiên trong đảo ở 2 m/s, đổi điểm khi tới nơi hoặc sau 240 tick. `chase` khi Mây ≤ 12 m (XZ), quay về `wander` khi > 18 m. `recoil`: đi xa Mây 2 m đều trong 60 tick sau khi gây hit, không gây hại. `stunned` 120 tick. Hết `stunned`/`recoil` thì về `chase` nếu Mây ≤ 12 m, không thì `wander`. Scenario không ghi `state` → `chase`; `state_ticks_left` mặc định 120 (stunned), 60 (recoil), 1 (spawning).
- **Vùng an toàn khi đèn vừa thắp:** Bóng trong vùng bị đẩy ra xuyên tâm 0.2 m/tick (6 m / 30 tick) tới mép 6 m + 0.001; trong lúc ở trong vùng không tự di chuyển và không gây hại.
- **Bị chạm:** Bóng trong trạng thái stunned/recoil/spawning hoặc đang trong vùng an toàn không gây hại. Chênh cao ≤ 1.5 m đo giữa `shade.pos.y` và chân Mây. Đom đóm rơi sinh tại y = 0, tạo ra ở pha Chạm (nên nhặt được từ tick sau). Hướng giật lùi = từ Mây ra xa Bóng.
- **Lướt:** hướng = hướng đang di chuyển (sau xoay camera); đứng yên thì hướng Mây đang quay mặt (mặc định +Z, cập nhật mỗi lần có `move`). Trong lúc lướt không đổi hướng, giữ nguyên độ cao (vy = 0), không bất tử. 12 tick, 14 m/s. Nhấn lướt khi đang lướt hoặc chưa hết hồi chiêu bị bỏ.
- **Nhảy/rơi:** mặt đất là đĩa bán kính 40 ở Y = 0. Chân Mây ngoài đĩa thì rơi tự do; đã chìm xuống dưới Y = 0 thì không đáp lại được. Y < −10 → sự kiện `player_hit {by:"fall", flames, dropped:0, lost}` (lost = số đom đóm bị mất), đúng 1 lần mỗi lần rơi, bỏ qua bất tử. Mây đứng yên (vận tốc 0) 60 tick, bỏ qua input/nhặt/chạm, rồi hồi sinh ở điểm xuất phát, bất tử 90 tick. Hết Ngọn Lửa thì thua ngay (`no_flames`).
- **Tạm dừng:** `pause` (cạnh false→true) bật/tắt. `tick` vẫn tăng, `sim_tick`/thời gian/hồi chiêu/spawn đứng yên, snapshot `state:"paused"`. Sự kiện `paused`/`resumed` ghi `tick` thật. Dòng `end` ghi `state` của game (không có `paused`). Nút khác nhấn lúc tạm dừng bị bỏ.
- **Snapshot:** `player.vel` = [vx, vy, vz] (m/s); `player.invuln` là boolean; `dash_cd_s`, `pulse_cd_s`, `charm_s` tính bằng giây; `motes[].ttl_s` = null với đom đóm ngẫu nhiên. `wind` luôn `{active:false, dir_deg:0}` và `drifters`, `charms` luôn `[]` ở Đêm 1.
- **`night_start {night}`** ghi ở tick 1 (bước đầu tiên).
- **Scenario mới:** `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`, `random_drifters`, `wind_enabled`, `drifters`, `charms` được kiểm định dạng. Ở phạm vi hiện tại (K1) `charm_ticks` chỉ được lưu/đếm lùi/ghi snapshot; hiệu lực Bùa Gió, Gió Lạc, gió mạnh thuộc K2–K3 (chưa làm).
- **Phạm vi:** `--night 2|3` được CLI nhận nhưng thoát mã 1 ("chưa hỗ trợ") cho tới khi làm K2.
