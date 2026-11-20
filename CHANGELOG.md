# Changelog

## Phase 4 — Ticket-04 "Bình minh" (Contract v1.3)
Không đổi luật, số liệu hay output headless (tất cả test Phase 1–3 vẫn đạt).

- `contract_version` `"1.2"` → `"1.3"`; `game.contract.json` thêm `bench_cmd` (`node bench/bench.mjs`) và `soak_cmd` (`node src/soak.js`); `build_cmd` thành `npm install && npx playwright install chromium`. Test `contract` · `trường bắt buộc` sửa kỳ vọng theo đó.
- Mới: `src/soak.js` (soak test, `soak.json`), `bench/bench.mjs` + `web/bench.html` + `web/bench.js` (benchmark Playwright 1280×720, `bench.json`), `tests/soak.test.js`, `tests/bench.test.js`.
- `web/render.js`: `sync` nhận thêm tham số camera tùy chọn (chỉ bench dùng); `web/vite.config.js` build thêm trang `bench.html`.
- Đóng gói: README đủ mục, CREDITS.md, LICENSE (MIT), bản web tĩnh `.zip` cho Release.
- R5: Đêm 2/3 trong sim và headless (`src/sim/maps.js`: mặt đứng nhiều tầng, dốc, cầu, bục nhảy, vách, gió mạnh; `step.js` tổng quát hóa di chuyển, Đêm 1 giữ nguyên từng byte). Sự kiện mới `jump_pad`, `wind_warning`, `wind_start`, `wind_end`; snapshot `wind` thật ở Đêm 3. Test `contract` · `--night: 0 và 4 …` đổi kỳ vọng: `--night 2/3` nay chạy mã 0 (trước đây mã 1 vì chưa có). Test mới: `tests/nights.test.js`.
- Gió Lạc và Bùa Gió (K3 Phase 2) trong sim: `drifters`/`charms` trong snapshot (trước đây luôn `[]`), sự kiện `drifter_spawned`, `drifter_steal`, `drifter_drop`, `charm_picked`; scenario `drifters`/`charms` có kiểm định dạng (mã thoát 2); `tests/drifters.test.js`. Test `nights` · cầu: thêm `charms: []` vì bùa mặc định (35,0,0) nằm trên cầu và đổi tốc độ.
- Giao diện web: menu chọn Đêm/chuỗi 1→2→3, màn kết quả (Đêm kế/chơi lại Đêm/menu, Bình Minh + tổng điểm), địa hình Đêm 2/3, thanh dầu, đồng hồ đỏ ≤ 30 s, vẽ Gió Lạc và Bùa Gió. `web/render.js` thêm `setNight`. Không đổi sim/headless.
- Chưa làm (xem README mục "Chưa đạt"): bảng xếp hạng, accessibility, âm thanh, tạm dừng, cài đặt.

## Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### Breaking changes
Mọi mục dưới đây đổi hành vi hoặc định dạng so với Contract v1.1 (Phase 2).

| # | Thay đổi | Trước (v1.1) | Sau (v1.2) |
|---|---|---|---|
| 1 | `contract_version` | `"1.1"` | `"1.2"` |
| 2 | Đèn đã sáng | không nhận thêm đom đóm, sáng mãi | có `fuel` (0–100), hao 1/s, **nhận châm dầu** khi bấm Tương tác |
| 3 | Hết dầu | không có | `fuel ≤ 0` → tắt, `deposited = 0`, sự kiện `lantern_out`, nhớ `ever_lit` |
| 4 | Thắp lại | không có | đèn `ever_lit` chỉ cần **5** đom đóm (đèn chưa từng sáng vẫn 10) |
| 5 | Chọn đèn khi Tương tác | chỉ đèn chưa sáng | đèn nhận được: chưa sáng, hoặc sáng nhưng chưa đầy dầu |
| 6 | Vùng an toàn | mọi đèn sáng | chỉ đèn sáng có `fuel ≥ 30` (đúng 30 vẫn còn) |
| 7 | Bóng Mực | không bao giờ vào vùng an toàn; không có trạng thái hút | thêm trạng thái `drain` (hút 5 dầu/s, cộng dồn); `wander` đi tới đèn yếu (`fuel < 30`) gần nhất |
| 8 | Thắng | thắp đủ đèn → thắng ngay (`all_lit`) | **hết giờ** + Mây còn sống + đèn sáng ≥ ceil(0.6×tổng) → `dawn_survived`; `all_lit` không còn dùng |
| 9 | Thời lượng Đêm 1/2/3 | 300 / 330 / 360 s | 240 / 270 / 300 s |
| 10 | Sức chứa | cố định 10 | `10 + 2 × successful_lights`, tối đa 20; snapshot `player.capacity` |
| 11 | Điểm | +10/đom đóm nạp, +100/đèn, +5/stun, thưởng giây còn lại ×2, +50/lửa | +5/đom đóm nạp (kể cả châm dầu), +100 thắp lần đầu, +40 thắp lại, +5 stun (+15 nếu đang `drain`), bình minh (thắng): +50+floor(fuel) mỗi đèn sáng, +50/lửa; **bỏ thưởng thời gian** |
| 12 | `tuning` | — | thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`; `score` đổi khóa (bỏ `per_second_left`; thêm `per_relight`, `per_stun_drain`, `per_lit_at_dawn`) |
| 13 | Snapshot | `lanterns[].{id,pos,lit,deposited}` | thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`; trạng thái Bóng Mực `drain` |
| 14 | Scenario | — | `lanterns[].{lit,fuel,ever_lit}`, `player.successful_lights`, `shades[].target_lantern_id` (sai định dạng → mã thoát 2); `lit:true` không có `fuel` → 100 |
| 15 | Sự kiện | — | mới: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick khi đang hút); `lantern_lit` thêm `relight` |
| 16 | Thứ tự trong tick | Ticket-02 | bước 2 trừ dầu (hao + bị hút), ngay sau đó đèn `fuel ≤ 0` tắt; xét thắng/thua sau mọi cập nhật |

Hệ quả cần biết: vì dầu hao trước khi xử lý Tương tác (bước 2 trước bước 5), đèn sáng không bao giờ "đầy dầu" đúng lúc người chơi bấm; mỗi lần châm tốn ít nhất 1 đom đóm (xem ADR 0001).

### Test Phase 1–2 bị luật mới làm sai (sửa/xóa có lý do, không skip)

| Test | Xử lý | Lý do |
|---|---|---|
| `contract` · `trường bắt buộc` | sửa kỳ vọng | contract_version đổi `1.1` → `1.2` |
| `contract` · `tuning đúng số chuẩn …` | sửa kỳ vọng + đổi tên | thời lượng Đêm 240/270/300, thêm 8 khóa tuning mới, bảng `score` mới |
| `contract` · `tuning khớp bảng trong assumptions.md` | giữ test, cập nhật bảng ở assumptions.md | test đòi mọi khóa tuning xuất hiện trong bảng |
| `contract` · `người chơi ở (0,0,0)…` | sửa kỳ vọng + đổi tên | Đêm 1 dài 240 s; thêm `player.capacity = 10` |
| `contract` · `5 đèn đúng tọa độ chuẩn` | mở rộng kiểm tra | đèn thêm `fuel 0`, `ever_lit false`, `relit_count 0` |
| `rules` · `time_left_s = 300 − bước/60` | sửa kỳ vọng + đổi tên | Đêm 1 dài 240 s (tick 120 → 238) |
| `rules` · `nạp hết carried … +10 điểm` | sửa kỳ vọng | điểm mỗi đom đóm nạp 10 → 5 (30 → 15) |
| `rules` · `nạp nhiều lần … (+7×10 + 100)` | sửa kỳ vọng | 7×5 + 100 |
| `rules` · `đèn đã thắp → không nạp thêm, không điểm` | thay bằng test mới | luật [THAY THẾ]: đèn sáng nhận châm dầu (sự kiện `refuel`, +5/đom đóm) |
| `rules` · `chỉ xét đèn chưa sáng: đèn sáng gần hơn bị bỏ qua` | thay bằng test mới | luật [THAY THẾ]: đèn sáng chưa đầy dầu được xét và được chọn nếu gần hơn |
| `rules` · `hết giờ → thua dawn …` | đổi tên (kỳ vọng giữ nguyên) | làm rõ: chỉ đúng khi 0 đèn sáng (< ngưỡng 3/5) |
| `rules` · `thắp đủ đèn → thắng all_lit …` | thay bằng test "thắp đủ đèn không kết thúc Đêm" | luật [THAY THẾ]: không còn thắng sớm; `all_lit` không dùng |
| `rules` · `thắp đèn cuối đúng tick hết giờ vẫn THẮNG` | **xóa** | tiền đề (thắng khi thắp đủ) đã bị bỏ; luật thắng mới có test riêng ở `tests/fuel.test.js` (nhóm `luật thắng dawn_survived`) |
| `rules` · `điểm cộng dồn …` | sửa kỳ vọng | 7×5 + 100 + 5 |
| `rules` · `pause: … thời gian` | sửa kỳ vọng | `time_left_s` = 240 − 10/60 |
| `rules` · `snapshot có đủ trường mới` | sửa kỳ vọng | `player` thêm khóa `capacity` |

Các test Phase 1–2 còn lại giữ nguyên và vẫn đạt. Test mới cho luật Phase 3: `tests/fuel.test.js`.

## Phase 2 — Ticket-02 (Contract v1.1)
Phạm vi K0 (harness) + K1 (số chuẩn, Đêm 1). Chi tiết: `docs/notes/phase2-spec.md`, `docs/notes/assumptions.md` mục "Thay đổi Phase 2".
- `contract_version` `"1.0"` → `"1.1"`; số chuẩn Ticket-02 thay mọi số tự chọn của Phase 1 (tuning, bản đồ Đêm 1, lướt, tỏa sáng, hồi chiêu, bất tử, điểm). Thứ tự xử lý trong tick được cố định.
- Test Phase 1 sai vì số mới: sửa kỳ vọng, không xóa/skip. 71 → 127 test.
- Chưa làm: K2–K5 (Đêm 2/3, Gió Lạc/Bùa Gió, hiệu năng, giao diện mới).

## Phase 1 — Ticket-01 / PRD-0 (Contract v1.0)
- Mô phỏng thuần, tất định (`src/sim`, PRNG có seed), CLI headless theo Test Contract (60 tick/giây, snapshot/sự kiện JSONL, mã thoát 0/1/2), `game.contract.json`.
- Giao diện Three.js + Vite chỉ vẽ và đọc input. Luật đầu tiên: nhặt đom đóm, thắp 5 đèn, Bóng Mực, tỏa sáng, 3 ngọn lửa, Đêm 1.
- 71 test node:test; kiểm tra đột biến tay 15/15 bị bắt.
