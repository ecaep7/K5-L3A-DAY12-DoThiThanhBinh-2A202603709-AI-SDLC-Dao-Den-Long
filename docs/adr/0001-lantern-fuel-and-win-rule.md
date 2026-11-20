# ADR 0001 — Nhiên liệu đèn và luật thắng "giữ đảo sáng tới bình minh"

Trạng thái: chấp nhận (Phase 3, Ticket-03, Contract v1.2)

## Bối cảnh
Playtest cho thấy người chơi giỏi thắp đủ 5 đèn trong 2 phút rồi ván kết thúc; cuối Đêm thiếu căng thẳng. Mô hình cũ của đèn chỉ có hai trạng thái một chiều: chưa sáng (`deposited < 10`) → sáng (mãi mãi, có vùng an toàn tuyệt đối). Thắng = tất cả đèn sáng.

## Quyết định
1. **Đèn có nhiên liệu.** Trạng thái đèn: `{lit, fuel, deposited, ever_lit, relit_count}`.
   - Tắt (`lit=false`, `fuel=0`) ⇄ Sáng (`lit=true`, `fuel ∈ (0,100]`).
   - Tắt → Sáng: nạp đủ chi phí (10 đom đóm nếu chưa từng sáng, 5 nếu `ever_lit`); `fuel = 100`.
   - Sáng → Sáng: châm dầu, +10 fuel mỗi đom đóm (dùng `ceil((100−fuel)/10)` đom đóm, tối đa số đang mang).
   - Sáng → Tắt: `fuel ≤ 0` (hao 1/s và bị mỗi Bóng Mực hút 5/s); `deposited` về 0, `ever_lit` giữ `true`.
2. **Dầu là số nguyên theo đơn vị 1/60** (100 dầu = 6000 đơn vị; hao 1 đơn vị/tick; hút 5 đơn vị/tick; mỗi đom đóm 600). Chỉ chia 60 và làm tròn 1 chữ số khi xuất snapshot/sự kiện. Lý do: các ngưỡng `fuel ≥ 30`, `fuel ≤ 0` và `ceil(...)` phải tất định tuyệt đối, tránh sai số số thực cộng dồn hàng nghìn lần.
3. **Vùng an toàn là hàm của dầu**, không phải của `lit`: có khi `lit && fuel ≥ 30`. Đèn yếu là mồi cho Bóng Mực (`drain`), tạo áp lực phải đi châm dầu.
4. **Luật thắng đổi từ "đạt trạng thái" sang "duy trì tới thời điểm"**: chỉ xét ở tick bình minh. Thắng nếu còn Ngọn Lửa và số đèn sáng ≥ ceil(0.6 × tổng). Không còn thắng sớm; thắp đủ đèn không kết thúc Đêm. Hết Ngọn Lửa luôn thua `no_flames` trước.
5. **Thứ tự tick:** trừ dầu ở bước 2, đèn `fuel ≤ 0` tắt ngay sau bước 2, xét thắng/thua ở bước cuối sau mọi cập nhật. Nhờ vậy đèn cạn đúng tick bình minh không được tính là sáng.
6. **Phần thưởng theo mục tiêu mới:** điểm bình minh = 50 + floor(fuel) mỗi đèn sáng; bỏ thưởng thời gian (không còn thắng sớm).

## Hệ quả
- **Breaking** cho scenario/test cũ (xem `CHANGELOG.md`): `all_lit` không còn xuất hiện; đèn sáng nhận Tương tác; Đêm ngắn hơn (240/270/300 s); điểm đổi.
- Vì dầu hao ở bước 2, trước bước 5 (Tương tác), đèn đang sáng lúc Tương tác luôn có `fuel < 100` → `used ≥ 1`. Nhánh "đèn đầy dầu không được chọn" được cài đúng theo ticket nhưng trong ván thường không chạm tới. Ghi nhận, không coi là lỗi.
- Có thêm trạng thái Bóng Mực `drain` và quan hệ mới Bóng Mực ↔ đèn (mục tiêu `target`, bộ đếm hút `drainTicks`).
- Sức chứa tăng dần (`10 + 2×lần thắp thành công`, tối đa 20) bù lại việc phải đi châm dầu nhiều.
- Test cũ gắn với "thắng khi thắp đủ" bị thay hoặc xóa có lý do (CHANGELOG); test mới ở `tests/fuel.test.js`.
- Giao diện (thanh dầu, nhấp nháy 1 Hz, chế độ mù màu) chưa làm trong Phase này.

## Phương án đã cân nhắc
- Dầu số thực: đơn giản hơn nhưng dễ lệch ngưỡng 30 và `ceil`; bị loại.
- Giữ thắng sớm song song với thắng bình minh: trái yêu cầu "không còn thắng sớm"; bị loại.
