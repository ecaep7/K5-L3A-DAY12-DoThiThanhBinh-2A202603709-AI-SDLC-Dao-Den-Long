Phase 2. Đọc docs/requirements/phase2-ticket-02.md (Ticket-02, Contract v1.1). Ticket thay toàn bộ số tự chọn ở Phase 1 bằng số chuẩn.

Làm theo thứ tự. MỖI KHỐI xong phải chạy npm test xanh rồi commit riêng, để khi hết giờ tôi tag được commit xanh gần nhất.

K0 – Harness: (a) skill .claude/skills/verify/SKILL.md: chạy npm test, chạy headless 2 lần cùng seed và so sánh tất định, lưu output vào docs/proof/phase2/. (b) Stop hook trong .claude/settings.json chạy npm test, chặn kết thúc khi test đỏ (máy tôi là Windows). (c) Cập nhật CLAUDE.md cho phạm vi Phase 2.
K1 – Số chuẩn + Contract v1.1 cho Đêm 1: tuning, thứ tự xử lý trong tick, bản đồ Đêm 1 chuẩn, lịch sinh, rơi khỏi đảo, đom đóm rơi, recoil, tên trạng thái Bóng Mực, cách tính điểm mới (+10 khi NẠP, không phải khi nhặt), lướt, pause, các trường mới của snapshot/scenario/input/event. Test Phase 1 nào sai vì số mới: sửa kỳ vọng và ghi lý do vào docs/notes/assumptions.md mục "Thay đổi Phase 2". Không xóa hay skip test âm thầm.
K2 – Đêm 2 và Đêm 3 (--night 2/3): bản đồ, cầu, tầng, dốc, vách, bục nhảy, tháp chuông, gió mạnh, tốc độ Bóng Mực Đêm 3.
K3 – Gió Lạc và Bùa Gió.
K4 – Đo hiệu năng: 1 Đêm 21.600 tick headless phải ≤ 30 s, ghi kết quả đo kèm cấu hình máy.
K5 – Giao diện: chuỗi 3 Đêm + menu, tạm dừng, cài đặt lưu localStorage, HUD đủ, bảng màu chuẩn, ánh sáng theo tiến độ, âm thanh tự sinh bằng WebAudio. Đo FPS.

Mỗi tính năng mới có ít nhất 1 scenario headless trong test. Viết docs/notes/phase2-spec.md với acceptance criteria cho từng mục Phần 3. Cập nhật docs/proof/traceability.md. Chỗ ticket mơ hồ: tự giả định hợp lý và ghi vào assumptions.md. Không thêm sáng tạo ngoài ticket.