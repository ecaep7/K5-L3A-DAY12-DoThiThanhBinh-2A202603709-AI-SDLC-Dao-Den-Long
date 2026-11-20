Phase 3. Đọc docs/requirements/phase3-ticket-03.md (Change Request, Contract v1.2). Ticket thay một số luật cũ (đánh dấu [THAY THẾ]).
Làm theo thứ tự, mỗi khối xong chạy npm test xanh rồi commit riêng:
P1 – Luật lõi + Contract v1.2: nhiên liệu đèn (đơn vị nguyên 1/60), châm dầu, chọn đèn khi tương tác, hết dầu và lantern_out, thắp lại (5 đom đóm), Bóng Mực drain và chuyển trạng thái, vùng an toàn theo fuel >= 30, luật thắng dawn_survived theo ngưỡng 60%, thời lượng Đêm mới, sức chứa tăng dần, công thức điểm mới, thứ tự trong tick, các trường snapshot/scenario/event mới. Ít nhất 1 scenario headless cho mỗi luật mới.
P2 – Test cũ bị luật mới làm sai: sửa hoặc xóa, ghi lý do từng test vào CHANGELOG.md. Không skip âm thầm.
P3 – Tài liệu: docs/adr/0001-lantern-fuel-and-win-rule.md (ADR ngắn: bối cảnh, quyết định, hệ quả cho mô hình trạng thái đèn và luật thắng); CHANGELOG.md mục Phase 3 liệt kê breaking changes; cập nhật assumptions.md, traceability.md, CLAUDE.md.
Xong P1–P3 thì commit, tag phase-3, push cả commit lẫn tag. Giao diện (thanh dầu, chế độ mù màu) để sau.
Chỗ mơ hồ: tự giả định hợp lý, ghi vào assumptions.md.