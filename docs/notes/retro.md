# Retro – Đảo Đèn Lồng (Day 12 · AI SDLC)

## 1. Số liệu tổng hợp
| Phase | Tag | Test | Chi phí ước tính | Quota tuần | Kết quả chính |
|---|---|---|---|---|---|
| 1 | phase-1 | 71/71 | $1.99 | 60% → 61% | Đêm 1 chơi được, headless theo Contract v1.0, tất định |
| 2 | phase-2 | 127/127 | $2.15 | 61% → 62% | Số chuẩn + Contract v1.1 cho Đêm 1; skill /verify + Stop hook |
| 3 | phase-3 | 168/168 | $1.87 | 62% → 64% | Dầu đèn, drain, luật thắng mới, Contract v1.2, ADR, CHANGELOG |
| 4 | phase-4 | 196/196 | $3.76 | 64% → 66% | Soak, bench, đóng gói, làm bù Phase 2, Release v1.0.0 |
| **Tổng** | | | **≈ $9.77** | **+6%** | |

Tôi vào lab trễ khoảng 1 giờ do phải cài Claude Code và chuẩn bị môi trường, nên mọi tag đều trễ hạn.

## 2. Đánh giá từng phase
- **Phase 1:** Đạt luật lõi, headless, tất định (chạy 2 lần giống từng byte). Giao diện chơi được. Thiếu: chưa tự chơi kỹ giao diện trước khi tag.
- **Phase 2:** Đạt số chuẩn + Contract v1.1 cho Đêm 1, lướt, rơi khỏi đảo, pause. Test Phase 1 sai vì số mới được sửa kỳ vọng kèm lý do, không xóa âm thầm. Do trễ giờ nên cắt phạm vi; Đêm 2/3, Gió Lạc, Bùa Gió và giao diện được làm bù ở Phase 4.
- **Phase 3:** Đạt toàn bộ luật lõi mới. 14 test cũ đỏ: 12 sửa kỳ vọng, 2 thay mới, 1 xóa, lý do ghi trong CHANGELOG. Lệch đề có ghi lại: Bóng Mực không "về đèn tắt gần nhất" vì Phase 2 chưa có hành vi đó. Chưa đạt ở tag phase-3: thanh dầu, chế độ mù màu.
- **Phase 4:** Bench trên máy tôi: avg 103.7 FPS, p1_low 30 FPS (vừa chạm ngưỡng), load 1.7 s; 2 lần chạy đầu trình duyệt bị đóng giữa chừng. Soak 10 Đêm xoay vòng 1→2→3, 0 crash, nhưng bộ nhớ tăng 1.24× (chưa đạt ngưỡng 1.2×, nguyên nhân JIT, không đổi cách đo để lách). Làm bù phần Phase 2: Đêm 2/3, Gió Lạc, Bùa Gió, giao diện 3 Đêm, bảng màu, HUD, tạm dừng, cài đặt, âm thanh. Chưa đạt: bảng xếp hạng, accessibility (trừ cỡ chữ 18 px), chế độ mù màu.

## 3. Điều hiệu quả và chưa hiệu quả khi làm với AI
**Hiệu quả**
- Lưu đề và prompt dài thành file (docs/requirements, docs/prompts) → agent tự đọc, không phải dán lại, có lịch sử prompt.
- Chia việc thành khối, mỗi khối commit khi test xanh → lúc hết giờ luôn có commit xanh để tag.
- Xếp ưu tiên theo cách chấm điểm: headless và đóng gói trước, giao diện sau.
- Mutation test (cố tình làm sai luật để thử test) → chứng minh test không phải loại luôn đạt.
- Giao giao diện theo đúng bảng màu và bố cục HUD trong ticket → vừa đẹp hơn vừa đúng yêu cầu.

**Chưa hiệu quả**
- Phase 1 bỏ qua bước duyệt kế hoạch.
- Chỉ dẫn mơ hồ ("còn rất ít thời gian") khiến agent bỏ việc R5 dù còn 40 phút → nên ghi mốc giờ cụ thể.
- Giao diện chỉ được làm ở cuối, nên trong Phase 2–3 khó thấy thay đổi khi chơi.

## 4. Những lần AI sai và cách phát hiện
Chi tiết trong docs/notes/ai-log.md. Tiêu biểu: ghi đè .gitignore làm mất dòng .env (phát hiện qua git diff); tính sai độ cao nhảy (test bắt được, sửa code chứ không nới test); bộ test sót luật cộng điểm (mutation test bắt được); bỏ việc sớm do hiểu chỉ dẫn quá đúng nghĩa; gộp commit dù được yêu cầu tách.

## 5. Harness hữu ích nhất
1. **Stop hook** chạy npm test, chặn agent báo xong khi test đỏ → không có lần nào agent "báo xong" mà test hỏng.
2. **Skill /verify**: chạy test, chạy headless 2 lần so tất định, lưu bằng chứng → bằng chứng tạo bằng lệnh, không sửa tay.
3. **CLAUDE.md** ngắn, cập nhật qua từng phase.

## 6. Token và cách tiết kiệm
- Tổng chi phí ước tính ≈ $9.77, quota tuần tăng 6% cho cả lab.
- Tắt cấu hình tốn kém: lượt đầu tiên tốn 37.2k token cache vì 15 MCP server và model Opus → chuyển sang Sonnet cho toàn bộ lab.
- /clear giữa các phase; ngữ cảnh dài hạn nằm trong file (CLAUDE.md, assumptions.md, ADR) → cache hit 95–98%.

## 7. Nếu làm lại
- Cài và thử Claude Code **trước** buổi lab.
- Đọc RUBRIC ngay từ đầu để xếp ưu tiên.
- Duyệt kế hoạch của agent trước khi cho code.
- Ra chỉ dẫn bằng mốc giờ cụ thể, không dùng từ mơ hồ.
- Dành thời gian tự chơi thử sau mỗi phase.