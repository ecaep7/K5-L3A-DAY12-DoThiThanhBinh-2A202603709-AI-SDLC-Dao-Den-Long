Bắt đầu Phase 1 (15:20): quota tuần 60%, session 5%. Model mặc định Opus.
Phát hiện: 1 lượt nhỏ tốn 37.2k cache write vì 15 MCP server nạp sẵn → tắt MCP, chuyển Sonnet.
## Cài đặt headless (Sonnet 5.5, plan mode trước khi code)
- Lập kế hoạch → duyệt → làm headless + test trước, giao diện sau.
- Lỗi của AI 1: ghi đè `.gitignore` mà chưa đọc, làm mất dòng `.env`; phát hiện qua `git diff`, đã khôi phục.
- Lỗi của AI 2: đỉnh nhảy ra 0.85 m thay vì 0.9 (tích phân Euler). Test bắt được; sửa sim, không sửa test.
- Kiểm tra "test không luôn đạt" (đột biến tay, tự khôi phục): 15 đột biến → lần đầu 14 bị bắt, 1 sót (`per_stun` cho con đang choáng). Thêm test, chạy lại: 15/15 bị bắt.
- `npm test`: 71 test xanh.

## Giao diện (web/)
- Không có công cụ điều khiển trình duyệt; kiểm bằng Chrome headless chụp ảnh (`docs/proof/ui-start.png`). Lần chụp đầu để Mây đứng yên 10 s ảo nên thua (đúng luật); thêm `?freeze=1` để chụp cảnh đầu ván.
- Chưa tự chơi tay tới thắng/thua trên giao diện: luật được kiểm bằng headless, giao diện chỉ vẽ.

Kết thúc Phase 1 (15:47): quota tuần 60% → 61%, session 5% → 14%.
Chi phí ước tính: $1.99 (Sonnet $1.98, Haiku $0.0005), 42 request, 29 phút, +1807 dòng code.
Cache hit 98% → tiết kiệm nhờ ngữ cảnh ổn định. Đổi sang Sonnet giúp Phase 1 chỉ tốn ~1% quota tuần.

16:15 Phase 3 mở khi Phase 2 mới bắt đầu → cắt phạm vi Phase 2 còn K0+K1, dời K2–K5 sang Phase 4 (test các phase trước vẫn được chạy lại ở tag sau).

## Lỗi của AI và cách xử lý

### Phase 1
1. **Ghi đè .gitignore khi chưa đọc file**
   - Chuyện gì xảy ra: Claude Code ghi đè `.gitignore`, làm mất dòng `.env`. Nếu không phát hiện thì có nguy cơ lộ API key lên GitHub.
   - Phát hiện: agent tự thấy khi xem `git diff`.
   - Xử lý: khôi phục dòng `.env`. Bài học cho harness: thêm vào CLAUDE.md quy tắc "đọc file trước khi ghi đè".

2. **Tính sai độ cao nhảy**
   - Chuyện gì xảy ra: mô phỏng cho độ cao nhảy 0.85 m thay vì 0.9 m như công thức (v²/2g).
   - Phát hiện: test đơn vị bắt được.
   - Xử lý: sửa cách tích phân trong `step.js`, giữ nguyên test (không nới test cho qua).

3. **Bộ test ban đầu còn sót luật**
   - Chuyện gì xảy ra: test không phát hiện lỗi cộng điểm `per_stun` cho Bóng Mực đang bị choáng.
   - Phát hiện: cố tình làm sai 15 chỗ trong luật để thử test (mutation test). Lần đầu test bắt được 14/15.
   - Xử lý: thêm test, chạy lại bắt được 15/15.

4. **Lỗi quy trình: bỏ qua bước duyệt kế hoạch**
   - Chuyện gì xảy ra: do gấp giờ, tôi cho agent code luôn mà chưa duyệt kế hoạch.
   - Xử lý: bù bằng kiểm chứng sau khi code (chạy test, chạy headless 2 lần so sánh tất định, chơi thử giao diện).
   - Bài học: lần sau duyệt plan trước, vì sửa hướng sau khi code tốn token hơn.

5. **Lãng phí token do cấu hình mặc định**
   - Chuyện gì xảy ra: một lượt nhỏ đầu tiên đã tốn 37.2k token cache vì 15 MCP server nạp sẵn mô tả công cụ, và model mặc định là Opus.
   - Phát hiện: lệnh `/usage`.
   - Xử lý: chuyển sang Sonnet, dùng `/clear` khi sang phase mới, lưu prompt dài vào file `docs/prompts/` để agent tự đọc. Kết quả: cả Phase 1 chỉ tốn khoảng 1% quota tuần.

### Phase 2
6. **Trễ giờ, phải cắt phạm vi**
   - Chuyện gì xảy ra: Phase 3 mở khi Phase 2 mới bắt đầu.
   - Xử lý: giữ K0 (harness) và K1 (số chuẩn + Contract v1.1 cho Đêm 1) cho tag phase-2. Dời Đêm 2/3, Gió Lạc, Bùa Gió và giao diện sang Phase 4, vì test của các phase trước vẫn được chạy lại ở tag sau.
Kết thúc Phase 2 (16:33): quota tuần 61% → 62%, session 14% → 26%.
Chi phí ước tính: $2.15 (Sonnet $2.15, Haiku $0.0001), 26 request, 26 phút, +856 / −202 dòng code.
Cache hit 95%. Kết quả: 127/127 test xanh, K0 (skill /verify + Stop hook) và K1 (số chuẩn + Contract v1.1 cho Đêm 1) xong; K2–K5 dời sang Phase 4.