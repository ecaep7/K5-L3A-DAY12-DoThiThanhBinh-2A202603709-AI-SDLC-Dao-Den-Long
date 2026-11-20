---
name: verify
description: Kiểm chứng Đảo Đèn Lồng - chạy npm test, chạy headless 2 lần cùng seed rồi so từng byte, lưu bằng chứng vào docs/proof/phase2/. Dùng trước khi báo xong hoặc commit một khối.
---

# verify

Chạy từ gốc repo:

```
node .claude/skills/verify/verify.mjs [--seed 1] [--ticks 3600]
```

Script làm theo thứ tự:
1. `npm test` (node:test). Đỏ thì dừng, mã thoát 1.
2. Với mỗi Đêm đã làm (hiện chỉ Đêm 1; K2 mở Đêm 2, 3): chạy headless 2 lần cùng seed/scenario/inputs, so sánh từng byte.
3. Ghi `docs/proof/phase2/verify-report.md` (kết quả thật) và các file `night<N>-run<1|2>.jsonl`.

Quy tắc: không sửa output bằng tay; báo cáo kèm kết quả thật. Nếu lệnh đỏ thì nói đỏ, không báo xong.
