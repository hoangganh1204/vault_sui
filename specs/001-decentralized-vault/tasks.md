# Tasks: VaultSui — Decentralized Sensitive Data Vault

**Input**: Design documents from `specs/001-decentralized-vault/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included per constitution (TDD mandated for core modules, each command needs 1 happy path + 2 error tests)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory structure: src/commands/, src/core/, src/adapters/, src/utils/, tests/core/, tests/commands/, tests/adapters/ per plan.md
- [x] T002 Initialize TypeScript project: package.json, tsconfig.json (strict mode, ES2022, NodeNext), install all dependencies (commander@12, @mysten/sui, @mysten/walrus, chalk@5, ora@8, cli-table3, nanoid@5, archiver@7, extract-zip, and devDeps jest@29, ts-jest, @types/node, @types/jest, @types/archiver, eslint, prettier)
- [x] T003 [P] Configure Jest (jest.config.ts with ts-jest preset), ESLint (.eslintrc.json with TypeScript strict rules), Prettier (.prettierrc), and add npm scripts: "test", "lint", "build" to package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Utilities

- [X] T004 [P] Implement VaultSuiError class with code/message/fix fields and all error codes (E001–E012) as constants in src/utils/errors.ts
- [X] T005 [P] TDD: Write tests then implement formatBytes() (human-readable: "2.0 KB", "4.2 MB") and truncateAddress() (0xABC...def) in src/utils/format.ts and tests/core/format.test.ts
- [X] T006 [P] TDD: Write tests then implement withRetry() exponential backoff wrapper (MAX_RETRIES=3, BACKOFF_DELAYS=[1000,2000,4000]ms) in src/utils/retry.ts and tests/core/retry.test.ts
- [X] T007 [P] Implement centralized logger with header("VaultSui 🔐"), divider, step(), success(), error(), spinner() using chalk+ora+cli-table3 in src/utils/logger.ts

### Core Domain Logic (TDD: write test → fail → implement → pass)

- [x] T008 [P] TDD: Write tests then implement generateVaultId() ("v_" + nanoid(6)) and validateVaultId() in src/core/vault-id.ts and tests/core/vault-id.test.ts
- [x] T009 [P] TDD: Write tests then implement computeChecksum() (SHA-256 hex) and verifyChecksum() in src/core/checksum.ts and tests/core/checksum.test.ts
- [x] T010 [P] TDD: Write tests then implement encrypt() and decrypt() using AES-256-GCM with KeyObject wrapping, layout [iv:12|tag:16|ciphertext:N], AAD=vaultId in src/core/encrypt.ts and tests/core/encrypt.test.ts
- [x] T011 [P] TDD: Write tests then implement compressFile() (archiver zip/deflate → Buffer) and decompressBuffer() (extract-zip) in src/core/compress.ts and tests/core/compress.test.ts
- [x] T012 [P] TDD: Write tests then implement createKeypair() (Ed25519 from private key string), getAddress(), signMessage(), verifySignature(), validateSuiAddress() (regex /^0x[0-9a-fA-F]{64}$/) in src/core/wallet.ts and tests/core/wallet.test.ts
- [x] T013 TDD: Write tests then implement createManifest(), parseManifest(), validateManifest() per manifest-schema.md contract (version, vaultId, fileName, checksum, encryptedKeys, allowedWallets, blobId) in src/core/manifest.ts and tests/core/manifest.test.ts

### I/O Adapters

- [x] T014 [P] Implement Walrus adapter: storeBlob() wrapping WalrusClient.writeBlob() and fetchBlob() wrapping readBlob(), with withRetry() wrapper, configure network from env VAULTSUI_NETWORK in src/adapters/walrus.ts
- [x] T015 [P] Implement Sui adapter: loadKeypair() from SUI_PRIVATE_KEY env or --wallet-key flag using Ed25519Keypair.fromSecretKey() in src/adapters/sui.ts
- [x] T016 [P] Implement filesystem adapter: readFileAsync(), writeFileAsync(), ensureDir() using fs/promises in src/adapters/fs.ts
- [x] T017 [P] TDD: Write tests then implement registry adapter: loadRegistry(), saveRegistry(), addVaultEntry(), getVaultEntries() for ~/.vaultsui/vaults.json per VaultRegistry schema in src/adapters/registry.ts and tests/adapters/registry.test.ts

### CLI Skeleton

- [x] T018 Create Commander.js CLI entry point with program name "vault-sui", version, description, global options (--wallet-key, --network), and stub subcommands (push, restore, list, verify) with --help in src/index.ts

**Checkpoint**: Foundation ready — all core modules tested, adapters implemented, CLI skeleton wired. User story implementation can now begin.

---

## Phase 3: User Story 1 — Owner Sao Lưu Dữ Liệu Nhạy Cảm (Priority: P1) 🎯 MVP

**Goal**: Owner encrypts and uploads a file to Walrus, receives Vault ID. Authorized wallets are embedded in manifest.

**Independent Test**: Push 1 file with --allow flag → receive Vault ID → verify blob exists on Walrus testnet

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T019 [P] [US1] Write push command tests in tests/commands/push.test.ts:
  - Happy path: push file with valid wallet → returns vault ID, calls compress→encrypt→storeBlob→saveRegistry
  - Error: wallet not configured → throws VaultSuiError E002
  - Error: invalid recipient address → throws VaultSuiError E003
  - Mock: Walrus storeBlob, filesystem readFile, registry saveRegistry

### Implementation for User Story 1

- [x] T020 [US1] Implement push command handler in src/commands/push.ts: validate inputs (file exists, wallet configured, addresses valid) → readFile → computeChecksum → compressFile → generate AES key → encrypt (with AAD=vaultId) → wrap key per wallet (owner + recipients via X25519 ECDH) → createManifest → storeBlob (data) → storeBlob (manifest) → addVaultEntry to registry → output success with logger
- [x] T021 [US1] Wire push command into CLI in src/index.ts: `program.command("push <path>")` with --allow and --epochs options per cli-commands.md contract

**Checkpoint**: `vault-sui push .env --allow 0x...` should work end-to-end. Owner can backup a file.

---

## Phase 4: User Story 2 — Recipient Khôi Phục Dữ Liệu (Priority: P1)

**Goal**: Recipient downloads and decrypts a vault using their wallet. Unauthorized wallets are rejected before download.

**Independent Test**: Restore vault created in US1 → verify file output matches original 100% (checksum)

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T022 [P] [US2] Write restore command tests in tests/commands/restore.test.ts:
  - Happy path: restore with authorized wallet → file written to --output dir, checksum matches
  - Error: unauthorized wallet → throws VaultSuiError E004 BEFORE downloading blob
  - Error: vault not found → throws VaultSuiError E007
  - Mock: Walrus fetchBlob, filesystem writeFile, wallet verifySignature

### Implementation for User Story 2

- [ ] T023 [US2] Implement restore command handler in src/commands/restore.ts: validate inputs (vaultId format, wallet configured) → fetchBlob (manifest) → parseManifest → check wallet in allowedWallets (reject E004 before blob download) → unwrap AES key via X25519 ECDH → fetchBlob (encrypted data) → decrypt → decompressBuffer → verifyChecksum (reject E009 if mismatch, do NOT write to disk) → writeFile → output success with logger
- [ ] T024 [US2] Wire restore command into CLI in src/index.ts: `program.command("restore <vault-id>")` with --output option per cli-commands.md contract

**Checkpoint**: `vault-sui restore v_XXXXXX --output ./restored/` should work. Full push→restore cycle functional.

---

## Phase 5: User Story 3 — Owner Liệt Kê Danh Mục Vault (Priority: P2)

**Goal**: Owner lists all vaults from local registry with metadata and status. Responds < 1 second.

**Independent Test**: Create multiple vaults → run list → verify table shows correct metadata and status

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [P] [US3] Write list command tests in tests/commands/list.test.ts:
  - Happy path: list with 3 vaults → displays table with vault_id, fileName, fileSize (human-readable), createdAt, status
  - Error: no vaults → displays "No vaults found" message with hint
  - Error: wallet not configured → throws VaultSuiError E002
  - Mock: registry loadRegistry

### Implementation for User Story 3

- [ ] T026 [US3] Implement list command handler in src/commands/list.ts: validate wallet configured → loadRegistry() → format table using cli-table3 with columns (ID, File, Size, Created, Status) → support --json flag for raw JSON output → output via logger
- [ ] T027 [US3] Wire list command into CLI in src/index.ts: `program.command("list")` with --json option per cli-commands.md contract

**Checkpoint**: `vault-sui list` should display all vaults in < 1 second.

---

## Phase 6: User Story 4 — Owner Kiểm Tra Tính Toàn Vẹn Vault (Priority: P2)

**Goal**: Owner verifies a specific vault: blob exists on Walrus, manifest valid. Responds < 5 seconds.

**Independent Test**: Verify vault just pushed → confirm "healthy" status with metadata

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T028 [P] [US4] Write verify command tests in tests/commands/verify.test.ts:
  - Happy path: verify existing vault → displays "healthy" with metadata (size, created, expires)
  - Error: blob unavailable on Walrus → displays "corrupted" with E012
  - Error: vault not found in registry → throws VaultSuiError E007
  - Mock: Walrus fetchBlob, registry loadRegistry

### Implementation for User Story 4

- [ ] T029 [US4] Implement verify command handler in src/commands/verify.ts: validate inputs (vaultId format, wallet configured) → look up vault in registry → fetchBlob (manifest) → parseManifest/validateManifest → attempt fetchBlob (data, head-only or small read) → if success: "healthy" with metadata; if fail: "corrupted" with E012 → output via logger
- [ ] T030 [US4] Wire verify command into CLI in src/index.ts: `program.command("verify <vault-id>")` per cli-commands.md contract

**Checkpoint**: `vault-sui verify v_XXXXXX` should report vault health in < 5 seconds.

---

## Phase 7: User Story 5 — Owner Khôi Phục Danh Mục Trên Máy Mới (Priority: P3)

**Goal**: Owner connects same wallet on new machine → all previously created vaults are recovered from on-chain manifest data. Completes < 30 seconds.

**Independent Test**: Delete local registry → reconnect same wallet → run list → verify all vaults appear

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T031 [P] [US5] Write portability tests in tests/commands/list.test.ts (extend existing):
  - Happy path: empty local registry + wallet with on-chain vaults → list recovers and displays all vaults
  - Error: wallet with no on-chain vaults → displays empty list

### Implementation for User Story 5

- [ ] T032 [US5] Implement on-chain vault recovery: when local registry is empty or missing, query Walrus/Sui for manifests associated with the current wallet address, parse each manifest, rebuild local registry, then display results in src/commands/list.ts and src/adapters/walrus.ts

**Checkpoint**: Fresh install + same wallet → `vault-sui list` recovers all vaults in < 30 seconds.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T033 [P] Add --help with usage examples for all 4 commands (push, restore, list, verify) per cli-commands.md contract in src/index.ts
- [ ] T034 [P] Run full test suite and verify coverage >= 80% for core modules (encrypt, compress, manifest, wallet, checksum, vault-id), add missing tests if needed
- [ ] T035 Run quickstart.md validation: end-to-end smoke test on Walrus testnet (push → list → verify → restore → compare checksums)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 Push (Phase 3)**: Depends on Foundational — BLOCKS US2 (need a vault to restore)
- **US2 Restore (Phase 4)**: Depends on US1 (needs pushed vault for testing)
- **US3 List (Phase 5)**: Depends on Foundational only — can run parallel with US1/US2
- **US4 Verify (Phase 6)**: Depends on Foundational only — can run parallel with US1/US2
- **US5 Portability (Phase 7)**: Depends on US3 (extends list command)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational
    ↓
    ├── Phase 3: US1 Push (P1) ──→ Phase 4: US2 Restore (P1)
    ├── Phase 5: US3 List (P2) ──→ Phase 7: US5 Portability (P3)
    └── Phase 6: US4 Verify (P2)
                                    ↓
                              Phase 8: Polish
```

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (TDD)
2. Implementation tasks in order: validate → core logic → CLI wiring
3. Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004–T007 (utils) can all run in parallel
- T008–T012 (core modules) can all run in parallel (after utils)
- T014–T017 (adapters) can all run in parallel
- T013 (manifest) depends on T008–T012 (uses entities from other core modules)

**Across User Stories**:
- US3 (List) and US4 (Verify) can start in parallel with US1 (Push)
- US1 must complete before US2 can be integration-tested

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch all utils in parallel:
Task T004: "Implement VaultSuiError in src/utils/errors.ts"
Task T005: "TDD format.ts in src/utils/format.ts"
Task T006: "TDD retry.ts in src/utils/retry.ts"
Task T007: "Implement logger in src/utils/logger.ts"

# Then launch all core modules in parallel:
Task T008: "TDD vault-id.ts in src/core/vault-id.ts"
Task T009: "TDD checksum.ts in src/core/checksum.ts"
Task T010: "TDD encrypt.ts in src/core/encrypt.ts"
Task T011: "TDD compress.ts in src/core/compress.ts"
Task T012: "TDD wallet.ts in src/core/wallet.ts"
```

## Parallel Example: User Story 1

```bash
# Write test first (can start immediately after Phase 2):
Task T019: "Write push command tests in tests/commands/push.test.ts"

# Then implement:
Task T020: "Implement push handler in src/commands/push.ts"
Task T021: "Wire push into CLI in src/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Push)
4. **STOP and VALIDATE**: Push a file to Walrus testnet, receive Vault ID
5. Demo-ready with core backup functionality

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Push) → Test independently → Demo: "Owner can backup" (MVP!)
3. Add US2 (Restore) → Test independently → Demo: "Full push-restore cycle"
4. Add US3 (List) + US4 (Verify) → Test independently → Demo: "Vault management"
5. Add US5 (Portability) → Test independently → Demo: "Cross-device recovery"
6. Polish → Coverage check, help text, smoke test → Release-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD is mandatory per constitution: write test → verify fail → implement → verify pass
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- AES key MUST only exist in-memory — never disk/log (constitution V. Security)
- All console output MUST go through src/utils/logger.ts (constitution III. UX)
