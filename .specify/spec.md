# Feature Specification: VaultSui

**Feature Branch**: `vk/515f-speckit-constitu`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "Giải pháp lưu trữ và chia sẻ dữ liệu nhạy cảm phi tập trung"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner Sao Lưu Dữ Liệu Nhạy Cảm (Priority: P1)

Owner chọn file hoặc thư mục nhạy cảm trên máy, chỉ định danh sách địa chỉ ví của các Recipient được phép truy cập, hệ thống mã hóa dữ liệu tại nguồn và đẩy lên kho lưu trữ phi tập trung Walrus, trả về Vault ID duy nhất.

**Why this priority**: Đây là chức năng cốt lõi — không có push thì không có gì để restore. Mọi flow khác đều phụ thuộc vào vault đã được tạo thành công.

**Independent Test**: Có thể test độc lập bằng cách push 1 file, nhận Vault ID, verify blob tồn tại trên Walrus testnet.

**Acceptance Scenarios**:

1. **Given** Owner có file `.env` và ví Sui đã kết nối, **When** chạy `vault-sui push .env --allow 0xRecipient1,0xRecipient2`, **Then** nhận được Vault ID, file được mã hóa + compress trước khi upload, hoàn thành < 15 giây cho file < 1MB
2. **Given** Owner chưa kết nối ví, **When** chạy `vault-sui push .env`, **Then** nhận error actionable: "Wallet not configured. Set SUI_PRIVATE_KEY env or use --wallet-key flag"
3. **Given** Owner chỉ định wallet address sai format, **When** chạy `vault-sui push .env --allow invalid_address`, **Then** nhận error: "Invalid Sui address format. Expected: 0x + 64 hex characters"

---

### User Story 2 - Recipient Khôi Phục Dữ Liệu (Priority: P1)

Recipient nhận Vault ID từ Owner qua kênh bất kỳ, dùng ví cá nhân để yêu cầu khôi phục. Hệ thống kiểm tra ví có trong danh sách ủy quyền, nếu hợp lệ thì tải và giải mã dữ liệu về máy Recipient ở trạng thái nguyên bản.

**Why this priority**: Restore là nửa còn lại của core flow — push vô nghĩa nếu không restore được. Cùng priority P1 với push.

**Independent Test**: Có thể test độc lập bằng cách restore vault đã tạo sẵn, verify file output khớp 100% với bản gốc.

**Acceptance Scenarios**:

1. **Given** Recipient có ví trong danh sách ủy quyền và Vault ID hợp lệ, **When** chạy `vault-sui restore <vault-id> --output ./restored/`, **Then** file được tải về và giải mã thành công, checksum khớp 100% bản gốc, hoàn thành < 15 giây cho file < 1MB
2. **Given** Recipient có ví KHÔNG trong danh sách ủy quyền, **When** chạy `vault-sui restore <vault-id>`, **Then** bị reject TRƯỚC khi download blob, nhận error: "Access denied. Your wallet 0xABC...def is not authorized for this vault"
3. **Given** Vault ID không tồn tại hoặc đã hết hạn, **When** chạy `vault-sui restore <invalid-vault-id>`, **Then** nhận error: "Vault not found or expired. Check the Vault ID and try again"

---

### User Story 3 - Owner Liệt Kê Danh Mục Vault (Priority: P2)

Owner liệt kê toàn bộ vault đã tạo, xem trạng thái từng vault (còn nguyên vẹn / đã hỏng / hết hạn lưu trữ).

**Why this priority**: Quan trọng cho quản lý nhưng không chặn core flow push/restore. Owner cần biết vault nào đang active.

**Independent Test**: Có thể test bằng cách tạo vài vault, chạy list, verify output hiển thị đúng metadata.

**Acceptance Scenarios**:

1. **Given** Owner đã tạo 3 vault trước đó, **When** chạy `vault-sui list`, **Then** hiển thị danh sách 3 vault với metadata (vault_id, created_at, file_name, status), respond < 1 giây
2. **Given** Owner chưa tạo vault nào, **When** chạy `vault-sui list`, **Then** hiển thị message: "No vaults found. Use 'vault-sui push <file>' to create your first vault"
3. **Given** Owner có vault đã hết hạn lưu trữ, **When** chạy `vault-sui list`, **Then** vault đó hiển thị status "expired" rõ ràng

---

### User Story 4 - Owner Kiểm Tra Tính Toàn Vẹn Vault (Priority: P2)

Owner kiểm tra trạng thái của vault cụ thể: blob còn tồn tại trên Walrus, checksum khớp manifest.

**Why this priority**: Verify đảm bảo data integrity — quan trọng nhưng không chặn core flow.

**Independent Test**: Có thể test bằng cách verify vault vừa push, confirm status "healthy".

**Acceptance Scenarios**:

1. **Given** Vault ID hợp lệ và blob còn tồn tại trên Walrus, **When** chạy `vault-sui verify <vault-id>`, **Then** hiển thị "Vault healthy ✅" với metadata (size, created_at, expires_at), respond < 5 giây
2. **Given** Vault ID hợp lệ nhưng blob đã bị mất trên Walrus, **When** chạy `vault-sui verify <vault-id>`, **Then** hiển thị "Vault corrupted ❌ — blob no longer available on Walrus network"
3. **Given** Vault ID không tồn tại, **When** chạy `vault-sui verify <invalid-id>`, **Then** hiển thị error: "Vault not found. Check the Vault ID and try again"

---

### User Story 5 - Owner Khôi Phục Trên Máy Mới (Priority: P3)

Owner cài đặt VaultSui trên máy mới, kết nối lại cùng ví, truy cập lại toàn bộ vault đã tạo trước đó.

**Why this priority**: Portability quan trọng cho long-term value nhưng không chặn MVP. Có thể workaround bằng cách backup manifest file thủ công.

**Independent Test**: Có thể test bằng cách xóa local config, re-init với cùng wallet, verify danh sách vault được khôi phục.

**Acceptance Scenarios**:

1. **Given** Owner có ví đã tạo vault trước đó và cài VaultSui trên máy mới, **When** chạy `vault-sui list` sau khi kết nối ví, **Then** toàn bộ vault hiển thị lại (lấy từ on-chain manifest), hoàn thành < 30 giây
2. **Given** Owner kết nối ví khác (không phải ví đã tạo vault), **When** chạy `vault-sui list`, **Then** hiển thị danh sách trống — không thấy vault của ví khác

---

### Edge Cases

- Network bị ngắt giữa chừng upload → retry 3 lần với exponential backoff, sau đó báo lỗi actionable
- File > 50MB → hiện warning "Large file support is experimental" (stream processing, out of scope MVP)
- Manifest local bị corrupt/xóa → có thể recover từ on-chain data bằng cùng wallet
- Walrus blob hết epoch storage → vault status chuyển thành "expired", báo rõ cho user
- Concurrent push từ cùng wallet → mỗi push tạo vault ID riêng, không conflict
- Invalid UTF-8 file path → validate và báo lỗi trước khi xử lý

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST mã hóa mọi dữ liệu (AES-256) trước khi rời thiết bị người dùng — không có dữ liệu thô trên storage layer
- **FR-002**: System MUST xác thực quyền truy cập dựa trên chữ ký số từ ví Sui — KHÔNG dùng username/password
- **FR-003**: System MUST hỗ trợ cấp quyền cho nhiều ví khác nhau trên cùng một vault; Owner luôn có quyền truy cập
- **FR-004**: System MUST phân quyền nghiêm ngặt: chỉ Owner tạo và chỉ định ủy quyền; Recipient chỉ restore
- **FR-005**: System MUST kiểm tra tính toàn vẹn (checksum) sau restore, TRƯỚC khi ghi ra disk — reject nếu sai lệch
- **FR-006**: System MUST lưu trữ bất biến trên Walrus — dữ liệu KHÔNG THỂ bị xóa/thay đổi bởi bất kỳ bên thứ ba
- **FR-007**: System MUST cho phép Owner liệt kê và kiểm tra trạng thái tất cả vault đã tạo
- **FR-008**: System MUST hỗ trợ lifecycle vault với thời hạn lưu trữ (Walrus epoch-based)
- **FR-009**: System MUST retry tối đa 3 lần với exponential backoff khi mất kết nối giữa chừng
- **FR-010**: System MUST compress dữ liệu trước khi encrypt để tối ưu storage cost
- **FR-011**: System MUST validate mọi input từ user (path, vault_id, wallet address) trước khi xử lý
- **FR-012**: System MUST reject unauthorized wallet TRƯỚC khi download encrypted blob

### Key Entities

- **Vault**: Đơn vị lưu trữ — chứa encrypted blob reference, manifest, owner address, allowed addresses, created_at, expires_at
- **Manifest**: Metadata của vault — schema_version, file_name, file_size, checksum (SHA-256), compression_algo, encryption_algo, allowed_wallets, blob_id
- **Owner**: Ví Sui tạo vault — có full quyền (push, restore, list, verify, manage access)
- **Recipient**: Ví Sui được ủy quyền — chỉ có quyền restore
- **Blob**: Encrypted + compressed data được lưu trên Walrus network
- **Vault ID**: Định danh duy nhất, có thể chia sẻ qua kênh không bảo mật

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Push file < 1MB hoàn thành trong < 15 giây (compress + encrypt + upload)
- **SC-002**: Restore file < 1MB hoàn thành trong < 15 giây (download + decrypt + decompress + verify)
- **SC-003**: Ví không có trong danh sách ủy quyền có xác suất giải mã dữ liệu = 0%, ngay cả khi có Vault ID
- **SC-004**: Tỷ lệ khôi phục thành công = 100% với các vault chưa hết hạn lưu trữ
- **SC-005**: Tỷ lệ file khôi phục sai lệch dù chỉ 1 bit so với bản gốc = 0%
- **SC-006**: Owner khôi phục toàn bộ danh mục vault trên máy mới chỉ qua ví, trong < 30 giây
- **SC-007**: Lệnh list trả về kết quả trong < 1 giây
- **SC-008**: Lệnh verify respond trong < 5 giây
- **SC-009**: Unit test suite chạy < 30 giây
- **SC-010**: Test coverage core modules >= 80%

## Assumptions

- User có Sui wallet (private key) sẵn sàng — hệ thống KHÔNG tạo wallet
- User có kết nối internet ổn định (có retry cho intermittent failures)
- Walrus testnet available và hoạt động ổn định trong quá trình development
- File size MVP target là < 50MB — large file streaming là out of scope phase 1
- Phase 1 là CLI tool — GUI/web interface là out of scope
- Không có centralized server, database, hay third-party API có thể takedown
- Manifest có thể lưu local + backup on-chain cho portability
- Walrus epoch-based storage — vault lifetime phụ thuộc vào số epoch đã trả phí
