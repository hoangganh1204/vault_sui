# Feature Specification: VaultSui — Decentralized Sensitive Data Vault

**Feature Branch**: `vk/515f-speckit-constitu`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "Xây dựng hệ thống VaultSui — Giải pháp lưu trữ và chia sẻ dữ liệu nhạy cảm phi tập trung"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner Sao Lưu Dữ Liệu Nhạy Cảm (Priority: P1)

Owner chọn file hoặc thư mục nhạy cảm trên máy (ví dụ: `.env`, secrets, config), chỉ định danh sách địa chỉ ví blockchain của các Recipient được phép truy cập. Hệ thống xác thực quyền sở hữu qua ví, niêm phong (mã hóa) dữ liệu ngay trên máy Owner trước khi chuyển vào kho lưu trữ phi tập trung, và trả về Vault ID duy nhất.

**Why this priority**: Đây là chức năng cốt lõi — không có push thì không có gì để restore. Mọi flow khác đều phụ thuộc vào vault đã được tạo thành công.

**Independent Test**: Có thể test độc lập bằng cách push 1 file, nhận Vault ID, verify rằng dữ liệu đã được niêm phong và lưu trữ thành công.

**Acceptance Scenarios**:

1. **Given** Owner có file nhạy cảm và ví đã kết nối, **When** Owner yêu cầu sao lưu file và chỉ định danh sách ví Recipient, **Then** hệ thống niêm phong dữ liệu tại máy Owner, chuyển vào kho lưu trữ phi tập trung, và trả về Vault ID duy nhất; hoàn thành < 15 giây cho file < 1MB
2. **Given** Owner chưa kết nối ví, **When** Owner yêu cầu sao lưu, **Then** hệ thống từ chối và hướng dẫn cách kết nối ví (actionable error)
3. **Given** Owner chỉ định địa chỉ ví không đúng format chuẩn, **When** Owner yêu cầu sao lưu, **Then** hệ thống từ chối và chỉ rõ format đúng

---

### User Story 2 - Recipient Khôi Phục Dữ Liệu (Priority: P1)

Recipient nhận Vault ID từ Owner qua kênh bất kỳ (Slack, email, chat), dùng ví cá nhân để yêu cầu khôi phục. Hệ thống kiểm tra ví Recipient có trong danh sách ủy quyền, nếu hợp lệ thì tải và giải mã dữ liệu về máy Recipient ở trạng thái nguyên bản.

**Why this priority**: Restore là nửa còn lại của core flow — push vô nghĩa nếu không restore được. Cùng priority P1 với push.

**Independent Test**: Có thể test độc lập bằng cách restore vault đã tạo sẵn, verify file output khớp 100% với bản gốc.

**Acceptance Scenarios**:

1. **Given** Recipient có ví trong danh sách ủy quyền và Vault ID hợp lệ, **When** Recipient yêu cầu khôi phục, **Then** dữ liệu được tải về và giải mã thành công, nội dung khớp 100% bản gốc (không sai lệch dù chỉ 1 bit), hoàn thành < 15 giây cho file < 1MB
2. **Given** Recipient có ví KHÔNG trong danh sách ủy quyền, **When** Recipient yêu cầu khôi phục, **Then** hệ thống từ chối TRƯỚC khi tải nội dung về máy, hiển thị lý do và địa chỉ ví bị từ chối (dạng rút gọn)
3. **Given** Vault ID không tồn tại hoặc vault đã hết hạn, **When** Recipient yêu cầu khôi phục, **Then** hệ thống thông báo rõ ràng vault không tồn tại hoặc đã hết hạn

---

### User Story 3 - Owner Liệt Kê Danh Mục Vault (Priority: P2)

Owner liệt kê toàn bộ vault đã tạo, xem trạng thái từng vault: còn nguyên vẹn, đã hỏng, hay đã hết hạn lưu trữ.

**Why this priority**: Quan trọng cho quản lý nhưng không chặn core flow push/restore. Owner cần biết vault nào đang active để chia sẻ hoặc gia hạn.

**Independent Test**: Có thể test bằng cách tạo vài vault, chạy liệt kê, verify output hiển thị đúng metadata và trạng thái.

**Acceptance Scenarios**:

1. **Given** Owner đã tạo nhiều vault trước đó, **When** Owner yêu cầu liệt kê, **Then** hệ thống hiển thị danh sách vault với metadata (vault_id, tên file, ngày tạo, trạng thái), respond < 1 giây
2. **Given** Owner chưa tạo vault nào, **When** Owner yêu cầu liệt kê, **Then** hệ thống hiển thị hướng dẫn cách tạo vault đầu tiên
3. **Given** Owner có vault đã hết hạn lưu trữ, **When** Owner yêu cầu liệt kê, **Then** vault đó hiển thị trạng thái "hết hạn" rõ ràng

---

### User Story 4 - Owner Kiểm Tra Tính Toàn Vẹn Vault (Priority: P2)

Owner kiểm tra trạng thái của vault cụ thể: dữ liệu còn tồn tại trên kho lưu trữ phi tập trung, tính toàn vẹn (checksum) có khớp với manifest ban đầu.

**Why this priority**: Verify đảm bảo data integrity — quan trọng nhưng không chặn core flow push/restore.

**Independent Test**: Có thể test bằng cách verify vault vừa push, confirm trạng thái "healthy".

**Acceptance Scenarios**:

1. **Given** Vault ID hợp lệ và dữ liệu còn tồn tại trên kho lưu trữ, **When** Owner yêu cầu kiểm tra, **Then** hiển thị trạng thái "healthy" với metadata (kích thước, ngày tạo, ngày hết hạn), respond < 5 giây
2. **Given** Vault ID hợp lệ nhưng dữ liệu đã bị mất trên kho lưu trữ, **When** Owner yêu cầu kiểm tra, **Then** hiển thị trạng thái "corrupted" với giải thích rõ ràng
3. **Given** Vault ID không tồn tại, **When** Owner yêu cầu kiểm tra, **Then** hiển thị lỗi rõ ràng và hướng dẫn kiểm tra lại Vault ID

---

### User Story 5 - Owner Khôi Phục Danh Mục Trên Máy Mới (Priority: P3)

Owner cài đặt VaultSui trên máy mới, kết nối lại cùng ví đã dùng trước đây. Hệ thống tự động nhận diện và cho phép Owner truy cập lại toàn bộ vault đã tạo trước đó — không cần backup config thủ công.

**Why this priority**: Portability quan trọng cho long-term value nhưng không chặn MVP. Có thể workaround bằng cách backup manifest file thủ công trong ngắn hạn.

**Independent Test**: Có thể test bằng cách xóa local config, kết nối lại cùng wallet, verify danh sách vault được khôi phục đầy đủ.

**Acceptance Scenarios**:

1. **Given** Owner có ví đã tạo vault trước đó và cài VaultSui trên máy mới, **When** Owner kết nối ví và yêu cầu liệt kê, **Then** toàn bộ vault hiển thị lại, hoàn thành < 30 giây
2. **Given** Owner kết nối ví khác (không phải ví đã tạo vault), **When** Owner yêu cầu liệt kê, **Then** hiển thị danh sách trống — không thấy vault của ví khác

---

### Edge Cases

- Mất kết nối mạng giữa chừng upload/download → hệ thống retry tối đa 3 lần trước khi báo lỗi actionable
- File kích thước lớn (> 50MB) → hệ thống cảnh báo "Large file support is experimental" (out of scope MVP)
- Danh mục vault local bị hỏng/mất → Owner có thể khôi phục từ dữ liệu on-chain bằng cùng ví
- Vault hết hạn lưu trữ (hết epoch) → trạng thái chuyển thành "expired", báo rõ cho user
- Nhiều lệnh push đồng thời từ cùng ví → mỗi push tạo Vault ID riêng, không xung đột
- Đường dẫn file chứa ký tự đặc biệt → validate và báo lỗi trước khi xử lý
- Dữ liệu bị sai lệch sau khôi phục → hệ thống phát hiện qua checksum, KHÔNG ghi file corrupt ra disk

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mọi dữ liệu PHẢI được mã hóa trước khi rời thiết bị người dùng; không có dữ liệu thô tồn tại trên kho lưu trữ
- **FR-002**: Quyền truy cập PHẢI dựa trên chữ ký số từ ví blockchain — KHÔNG dùng username/password
- **FR-003**: Một vault PHẢI hỗ trợ cấp quyền cho nhiều ví khác nhau; Owner luôn có quyền truy cập vault của mình
- **FR-004**: Chỉ Owner mới có quyền tạo vault và chỉ định ví ủy quyền; Recipient chỉ có quyền khôi phục, KHÔNG được thêm/bớt Recipient khác hay sửa vault
- **FR-005**: Dữ liệu sau khôi phục PHẢI khớp 100% với bản gốc; nếu phát hiện sai lệch, hệ thống PHẢI cảnh báo và KHÔNG ghi dữ liệu corrupt ra disk
- **FR-006**: Dữ liệu đã đẩy lên kho lưu trữ KHÔNG THỂ bị xóa hoặc thay đổi bởi bất kỳ bên thứ ba nào, kể cả developer của hệ thống
- **FR-007**: Người dùng PHẢI có thể liệt kê và kiểm tra trạng thái (còn tồn tại / đã hỏng / hết hạn) của tất cả vault đã tạo
- **FR-008**: Mỗi vault PHẢI có thời hạn lưu trữ định trước; Owner có thể chỉ định thời hạn khi tạo
- **FR-009**: Khi mất kết nối giữa chừng, hệ thống PHẢI tự retry tối đa 3 lần trước khi báo lỗi
- **FR-010**: Dữ liệu PHẢI được nén trước khi mã hóa để tối ưu chi phí lưu trữ
- **FR-011**: Mọi input từ user (đường dẫn, vault_id, địa chỉ ví) PHẢI được validate trước khi xử lý
- **FR-012**: Ví không có trong danh sách ủy quyền PHẢI bị từ chối TRƯỚC khi tải nội dung mã hóa về máy
- **FR-013**: Vault ID là định danh duy nhất, có thể chia sẻ qua kênh không bảo mật mà không ảnh hưởng bảo mật
- **FR-014**: Mọi thông tin nhạy cảm (khóa mã hóa, khóa riêng ví, nội dung file gốc) KHÔNG BAO GIỜ được ghi ra log hoặc lưu trữ vĩnh viễn

### Key Entities

- **Vault**: Đơn vị lưu trữ — chứa tham chiếu đến dữ liệu đã niêm phong, manifest, địa chỉ Owner, danh sách ví được ủy quyền, thời gian tạo và hết hạn
- **Manifest**: Metadata của vault — phiên bản schema, tên file gốc, kích thước, checksum toàn vẹn, thuật toán nén và mã hóa, danh sách ví ủy quyền, tham chiếu blob
- **Owner**: Ví blockchain tạo vault — có full quyền (sao lưu, khôi phục, liệt kê, kiểm tra, quản lý ủy quyền)
- **Recipient**: Ví blockchain được ủy quyền — chỉ có quyền khôi phục dữ liệu
- **Blob**: Dữ liệu đã nén + mã hóa được lưu trên kho lưu trữ phi tập trung
- **Vault ID**: Định danh duy nhất cho mỗi vault, an toàn khi chia sẻ qua kênh công khai

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Owner hoàn thành sao lưu file < 1MB trong < 15 giây (từ lúc bắt đầu đến khi nhận Vault ID)
- **SC-002**: Recipient hoàn thành khôi phục file < 1MB trong < 15 giây (từ lúc nhập Vault ID đến khi có file trên máy)
- **SC-003**: Ví không có trong danh sách ủy quyền có xác suất giải mã dữ liệu = 0%, ngay cả khi có Vault ID
- **SC-004**: Tỷ lệ khôi phục thành công = 100% với các vault chưa hết hạn lưu trữ
- **SC-005**: Tỷ lệ file khôi phục sai lệch dù chỉ 1 bit so với bản gốc = 0%
- **SC-006**: Owner khôi phục toàn bộ danh mục vault trên máy mới chỉ qua việc kết nối cùng ví, trong < 30 giây
- **SC-007**: Lệnh liệt kê danh mục trả về kết quả trong < 1 giây
- **SC-008**: Lệnh kiểm tra tính toàn vẹn respond trong < 5 giây

## Assumptions

- User đã có ví blockchain sẵn sàng — hệ thống KHÔNG tạo ví mới cho user
- User có kết nối internet (hệ thống có retry cho intermittent failures)
- Kho lưu trữ phi tập trung available và ổn định trong quá trình sử dụng
- File size MVP target là < 50MB — hỗ trợ file lớn hơn qua streaming là out of scope phase 1
- Phase 1 là CLI tool — giao diện đồ họa (GUI/web) là out of scope
- KHÔNG có server trung tâm, database trung tâm, hay third-party API có thể bị takedown
- Manifest có thể lưu local + backup on-chain để đảm bảo portability
- Thời hạn lưu trữ vault phụ thuộc vào cơ chế epoch của kho lưu trữ phi tập trung
