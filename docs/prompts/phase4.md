Phase 4. Đọc docs/requirements/phase4-ticket-04.md (Contract v1.3). Còn rất ít thời gian. Làm đúng thứ tự, mỗi khối xong chạy npm test xanh rồi commit riêng.
R1 – Soak: soak_cmd (node, headless, cùng một tiến trình) theo mục 2. Xoay vòng các Đêm đang hỗ trợ; nếu chưa có Đêm 2/3 thì ghi rõ là chưa đạt phần xoay vòng. Chạy thật với --seed 7 --nights 10, commit soak.json.
R2 – Contract v1.3: thêm bench_cmd và soak_cmd vào game.contract.json.
R3 – Đóng gói: build bản web tĩnh và nén thành file zip để đính kèm Release. README đủ mục theo mục 5 (cài và chạy tối đa 3 lệnh trên macOS/Linux, điều khiển, test, headless, bench, soak, và mục "Chưa đạt" liệt kê trung thực phần chưa làm). CHANGELOG.md có mục cho cả 4 phase. CREDITS.md (Three.js, Vite, công cụ AI: Claude Code với Sonnet 5.5). LICENSE MIT.
R4 – Bench: bench_cmd dùng Playwright mở cửa sổ trình duyệt 1280x720, dựng cảnh bench đúng mục 1, tính avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms đúng định nghĩa; peak_mem_mb = null kèm giải thích. Chạy thật trên máy tôi, commit bench.json.
R5 – Nếu còn thời gian: Đêm 2 và Đêm 3 (phần K2 của Phase 2).
Không làm: bảng xếp hạng, accessibility, Gió Lạc, Bùa Gió. Ghi "chưa đạt" kèm lý do trong docs/proof/traceability.md.
Cập nhật traceability.md và CLAUDE.md. KHÔNG tag phase-4 và KHÔNG tạo GitHub Release: tôi sẽ tự làm.