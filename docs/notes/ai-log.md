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
