# VaultSui Constitution

## Core Principles

### I. Code Quality

- Tuân thủ Clean Code, hàm không quá 30 dòng
- Đặt tên theo convention: camelCase cho biến và function, PascalCase cho class và type, UPPER_SNAKE_CASE cho constant
- Không có magic number, phải đưa vào constant có tên rõ nghĩa (ví dụ: `MAX_RETRIES = 3`, không phải số 3 trong code)
- Không nested if/try quá 3 tầng — tách thành function riêng nếu phức tạp hơn
- Mọi function phải có TypeScript type annotation đầy đủ, KHÔNG dùng `any` (dùng `unknown` nếu thực sự cần)
- Mọi async function phải có proper error handling — KHÔNG silently catch lỗi
- Comment chỉ giải thích WHY, không giải thích WHAT (code tự nói được)
- Mỗi file không quá 300 dòng — chia nhỏ nếu lớn hơn
- Tuân thủ Single Responsibility Principle: mỗi module chỉ làm một việc

### II. Testing

- Mọi business logic trong `src/core/` phải có unit test
- Coverage tối thiểu 80% cho core modules (encrypt, compress, manifest, wallet)
- Mỗi command (push/restore/list/verify) phải có ít nhất:
  - 1 test happy path
  - 2 test error scenarios
- Tuân thủ TDD: viết test trước, implement sau (red-green-refactor)
- Mock Walrus và Sui calls trong unit test — không gọi network thật
- Integration test với Walrus testnet thật cho luồng end-to-end (ít nhất 1 test per command)
- Test phải chạy < 30 giây cho toàn bộ unit test suite

### III. UX Consistency (Terminal UX)

- Mọi output PHẢI đi qua `src/utils/logger.ts` — không có `console.log` rải rác
- Mọi operation > 2 giây PHẢI có spinner (ora) với message rõ ràng
- Format thống nhất cho mọi command:
  - Header: `"VaultSui 🔐"`
  - Divider: `"──────────────────────────────────────"`
  - Step: `"✔ {message}    {detail}"`
  - Success final: `"✅ {message}"` + metadata block
  - Error final: `"❌ {message}"` + actionable hint
- Mọi error message PHẢI actionable: nói rõ vấn đề + cách fix (ví dụ: `"Wallet not configured. Set SUI_PRIVATE_KEY env or use --wallet-key flag"`)
- Mọi command PHẢI có `--help` flag với examples
- Wallet address hiển thị dạng truncated: `"0xABC...def"` (không hiển thị full)
- Bytes hiển thị human-readable: `"2.0 KB"`, `"4.2 MB"` — không phải `"2048 bytes"`

### IV. Performance

- Push file < 1MB hoàn thành trong < 15 giây (bao gồm compress + encrypt + upload)
- Restore file < 1MB hoàn thành trong < 15 giây
- List command respond trong < 1 giây (chỉ đọc local config)
- Verify command respond trong < 5 giây
- Mọi Walrus call có retry logic: tối đa 3 lần với exponential backoff (1s, 2s, 4s)
- KHÔNG block main thread bằng sync I/O — tất cả file system và network operation phải async
- KHÔNG load toàn bộ file vào memory nếu > 50MB — dùng stream (out of scope MVP, nhưng để mở)

### V. Security (NON-NEGOTIABLE)

- AES encryption key KHÔNG BAO GIỜ được ghi xuống disk, log, hay environment variable
- AES key chỉ tồn tại in-memory trong quá trình encrypt/decrypt — bị garbage collect ngay sau đó
- Private key (Sui wallet) KHÔNG BAO GIỜ rời khỏi máy user — chỉ dùng để sign local message
- KHÔNG log: private key, AES key, plaintext file content, wallet signature
- Logging có thể chứa: vault_id, blob_id, wallet address (truncated), timestamps
- Mọi input từ user (path, vault_id, wallet address) PHẢI validate trước khi xử lý
- Wallet address format PHẢI verify khớp Sui standard (0x + 64 hex chars)
- Manifest PHẢI có schema version để forward-compatibility
- Checksum verify SAU KHI restore, TRƯỚC khi ghi file ra disk — không ghi data corrupt
- Unauthorized wallet PHẢI bị reject TRƯỚC khi download encrypted blob (không waste bandwidth + giảm leak surface)

## Additional Constraints

### Decentralization

- KHÔNG được thêm bất kỳ thành phần centralized nào (server, database trung tâm, third-party API có thể takedown) vào phase 1
- Storage layer là Walrus (decentralized) — không có fallback centralized
- Authentication dựa hoàn toàn trên Sui wallet signature — không có auth server

### Error Handling & Resilience

- Mọi Walrus/network call có retry logic: tối đa 3 lần với exponential backoff (1s, 2s, 4s)
- Mọi async function phải có proper error handling — KHÔNG silently catch lỗi
- Error message phải actionable: nói rõ vấn đề + cách fix

## Governance

- Khi có xung đột giữa security và performance: **ưu tiên security tuyệt đối** — không có exception
- Khi có xung đột giữa security và UX: **ưu tiên security** (nhưng tìm cách giải thích rõ cho user)
- Khi có xung đột giữa performance và code quality: **ưu tiên code quality** trừ khi performance ảnh hưởng đến success criteria đã cam kết (< 15 giây)
- Khi có xung đột giữa scope và deadline: **ưu tiên cắt scope** theo Out of Scope đã định nghĩa — KHÔNG hạ tiêu chuẩn code/test/security
- Mọi quyết định trái với constitution PHẢI được ghi chú lý do trong commit message hoặc code comment với prefix `// CONSTITUTION-EXCEPTION:`
- Khi không chắc chắn — chọn phương án an toàn hơn về security, kể cả khi chậm hơn
- Decentralization là nguyên tắc cốt lõi: KHÔNG thỏa hiệp

**Version**: 1.0.0 | **Ratified**: 2026-05-17 | **Last Amended**: 2026-05-17
