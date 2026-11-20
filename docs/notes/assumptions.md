# Giả định – Phase 1

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

## Tuning
| Tham số | Giá trị | Tham số | Giá trị |
|---|---|---|---|
| player_speed | 6 | pulse_stun_s | 3 |
| carry_capacity | 10 | pulse_push_m | 4 |
| lantern_cost | 5 | pulse_cooldown_s | 1 |
| lantern_count_night1 | 5 | safe_radius | 5 |
| pickup_radius | 1.5 | shade_speed | 3.5 |
| interact_radius | 2.5 | shade_hit_radius | 1 |
| pulse_cost | 2 | fall_enabled | false |
| pulse_radius | 6 | night1_duration_s | 300 |
| flames | 3 | invuln_s | 1.5 |
| hit_drop_ratio | 0.5 | | |
| score.per_mote 10 · per_lantern 100 · per_stun 20 · per_second_left 1 · per_flame_left 50 | | | |
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
