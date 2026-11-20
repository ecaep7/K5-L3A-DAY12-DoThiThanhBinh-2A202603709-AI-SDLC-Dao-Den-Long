# Đảo Đèn Lồng – Phase 4 (Contract v1.3)

## Lệnh
- Cài: `npm install`
- Test: `npm test` (node:test, không thêm thư viện test)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]`
- Giao diện: `npm run dev` · build web: `npm run build:web`

## Cấu trúc
- `src/sim/`: logic thuần, tất định. CẤM import three, CẤM `Math.random` và `Date`. Dùng PRNG có seed (`rng.js`).
- `src/headless.js`: CLI đúng Test Contract (v1.0 → v1.2: docs/requirements/phase1-PRD-0.md mục B–E, phase3-ticket-03.md mục 7).
- `web/`: Three.js + Vite, chỉ vẽ và đọc input, dùng lại `src/sim`.
- `tests/`: node:test. Số tuning chỉ nằm ở `src/sim/tuning.js`, phải khớp `game.contract.json`.
- Luật và giả định: docs/notes/assumptions.md (đổi luật thì sửa file này cùng lúc).

## Test Contract cần nhớ
- 60 tick/giây; snapshot tick 0 trước khi áp input; bước k đọc input tick k, sự kiện ghi tick k+1.
- Mã thoát: 0 ok · 2 inputs/scenario sai định dạng · 1 lỗi khác (lỗi ghi ra stderr).
- Cùng seed + scenario + inputs → output giống hệt từng byte.

## Quy tắc
- Không sửa output (jsonl, snapshot, proof) bằng tay; chỉ tạo lại bằng lệnh.
- Không viết test luôn đạt: mỗi test phải có thể đỏ khi luật sai; kỳ vọng tính từ assumptions.md, không chép từ output.
- Phải chạy `npm test` xanh trước khi báo xong; báo kèm kết quả thật, nếu đỏ thì nói đỏ.
- Làm headless + test trước, giao diện sau.
- Phần sáng tạo không được đổi output headless (tắt khi headless).
- Không commit/tag `phase-1` khi chưa được người dùng đồng ý.

## Phạm vi Phase 2 (Ticket-02, docs/requirements/phase2-ticket-02.md)
- Phạm vi đã chốt: chỉ K0 (harness) + K1 (số chuẩn, Contract v1.1, Đêm 1). K2–K5 (Đêm 2/3, Gió Lạc/Bùa Gió, hiệu năng, giao diện mới) để sau; đừng làm khi chưa được yêu cầu.
- Số chuẩn Phần 1 của ticket thay mọi số tự chọn Phase 1. Test Phase 1 sai vì số mới: sửa kỳ vọng và ghi lý do ở docs/notes/assumptions.md mục "Thay đổi Phase 2"; không xóa/skip test âm thầm.
- Thứ tự xử lý trong tick theo Phần 1 ticket (ghi lại ở assumptions.md).
- Mỗi khối xong: `npm test` xanh rồi commit riêng. Kiểm chứng: skill `/verify` (.claude/skills/verify). Stop hook chạy `npm test` và chặn kết thúc khi đỏ.
- Tag `phase-2` và push chỉ khi người dùng yêu cầu (lần này đã được yêu cầu).

## Phạm vi Phase 3 (Ticket-03, docs/requirements/phase3-ticket-03.md)
- Luật hiện hành: Ticket-03 thay một số luật Ticket-02 (nhiên liệu đèn, `drain`, thắng `dawn_survived`, sức chứa tăng dần, điểm mới, Đêm 240/270/300 s). Chi tiết: docs/notes/assumptions.md mục "Thay đổi Phase 3"; lý do: docs/adr/0001-lantern-fuel-and-win-rule.md; breaking changes và lý do sửa test: CHANGELOG.md.
- Dầu đèn tính bằng **số nguyên 1/60** (`FUEL` trong `src/sim/tuning.js`); chỉ chia 60 và làm tròn khi xuất. Đừng dùng số thực cho dầu.
- Test Phase 3 ở `tests/fuel.test.js`. Test cũ bị luật mới làm sai: sửa/xóa kèm lý do trong CHANGELOG.md, không skip.
- Chưa làm (để sau): thanh dầu, nhấp nháy 1 Hz, chế độ mù màu, Đêm 2/3, Gió Lạc/Bùa Gió.
- Tag `phase-3` và push: đã được yêu cầu trong docs/prompts/phase3.md.

## Phạm vi Phase 4 (Ticket-04, docs/requirements/phase4-ticket-04.md)
- Đã làm: soak (`node src/soak.js --seed 7 --nights 10 --out soak.json`), bench (`node bench/bench.mjs --seed 42 --duration 30 --out bench.json`, Playwright, cần `npx playwright install chromium`), Contract v1.3, đóng gói (README, CHANGELOG, CREDITS, LICENSE, zip ở `release/`).
- Chưa làm: Đêm 2/3 (nên soak chưa xoay vòng), bảng xếp hạng, accessibility, Gió Lạc/Bùa Gió. Xem docs/proof/traceability.md. Đừng làm khi chưa được yêu cầu.
- `soak.json`, `bench.json` là output chạy thật, không sửa tay. Cảnh bench không đổi luật sim; `web/bench.js` tự cập nhật Bóng Mực wander (xấp xỉ luật gốc, không đuổi Mây).
- KHÔNG tag `phase-4` và KHÔNG tạo GitHub Release: người dùng tự làm.
