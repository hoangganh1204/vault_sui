# Implementation Plan: VaultSui — Decentralized Sensitive Data Vault

**Branch**: `vk/515f-speckit-constitu` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-decentralized-vault/spec.md`

## Summary

Build a CLI tool that lets developers encrypt sensitive files (`.env`, secrets, config) on their machine, upload encrypted data to Walrus decentralized storage, and share access with team members via Sui wallet addresses. Authentication is wallet-based (Ed25519 signature), access control uses per-recipient key wrapping via X25519 ECDH, and all data is encrypted before leaving the user's device.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 18+ LTS, compiled via `tsc`
**Primary Dependencies**: Commander.js 12.x, @mysten/sui (latest), @mysten/walrus (latest), chalk 5.x, ora 8.x, cli-table3 0.6.x, nanoid 5.x, archiver 7.x, extract-zip 2.x
**Storage**: Walrus decentralized network (testnet/mainnet) + local `~/.vaultsui/vaults.json`
**Testing**: Jest 29.x + ts-jest, ESLint + Prettier
**Target Platform**: macOS, Linux (Windows out of scope for MVP)
**Project Type**: CLI application (monolithic, single npm-distributable binary)
**Performance Goals**: Push/restore < 15s for file < 1MB, list < 1s, verify < 5s
**Constraints**: AES key never on disk/log, private key never leaves device, all I/O async, no centralized components
**Scale/Scope**: Individual developers and small teams, files < 50MB (MVP)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Phase 0 | Post-Phase 1 | Notes |
|-----------|-------------|--------------|-------|
| I. Code Quality | ✅ PASS | ✅ PASS | TypeScript strict, camelCase/PascalCase/UPPER_SNAKE_CASE conventions, SRP via hexagonal architecture |
| II. Testing | ✅ PASS | ✅ PASS | Jest + ts-jest, TDD workflow, mock Walrus/Sui in unit tests, test structure mirrors src |
| III. UX Consistency | ✅ PASS | ✅ PASS | Centralized logger.ts with chalk+ora, consistent output format defined in CLI contracts |
| IV. Performance | ✅ PASS | ✅ PASS | Async I/O, retry with backoff, <15s targets achievable with Walrus SDK |
| V. Security | ✅ PASS | ✅ PASS | AES-256-GCM with KeyObject (no disk/log), X25519 key exchange, checksum before write |
| VI. Governance | ✅ PASS | ✅ PASS | No centralized components, decentralization maintained |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-decentralized-vault/
├── plan.md              # This file
├── research.md          # Phase 0: Technology research and decisions
├── data-model.md        # Phase 1: Entity definitions and relationships
├── quickstart.md        # Phase 1: Development setup guide
├── contracts/
│   ├── cli-commands.md  # Phase 1: CLI command contracts (input/output/errors)
│   └── manifest-schema.md # Phase 1: Manifest and registry JSON schemas
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── index.ts             # CLI entry point (Commander.js setup)
├── commands/            # Command handlers (orchestration layer)
│   ├── push.ts          # Push command: file → compress → encrypt → upload
│   ├── restore.ts       # Restore command: download → decrypt → decompress → verify
│   ├── list.ts          # List command: read local registry → display
│   └── verify.ts        # Verify command: check blob existence on Walrus
├── core/                # Domain logic (pure functions, no I/O)
│   ├── encrypt.ts       # AES-256-GCM encrypt/decrypt with KeyObject
│   ├── compress.ts      # Zip compress/decompress via archiver/extract-zip
│   ├── manifest.ts      # Manifest create/parse/validate
│   ├── wallet.ts        # Wallet auth, signing, address validation
│   ├── vault-id.ts      # Vault ID generation (v_ + nanoid(6)) and validation
│   └── checksum.ts      # SHA-256 checksum compute/verify
├── adapters/            # I/O adapters (external dependencies)
│   ├── walrus.ts        # Walrus SDK wrapper (writeBlob/readBlob + retry)
│   ├── sui.ts           # Sui Ed25519Keypair adapter
│   ├── fs.ts            # Local filesystem read/write operations
│   └── registry.ts      # ~/.vaultsui/vaults.json read/write
└── utils/               # Shared helpers
    ├── logger.ts        # Centralized output (chalk + ora + cli-table3)
    ├── retry.ts         # Exponential backoff retry (MAX_RETRIES=3, delays=[1s,2s,4s])
    ├── format.ts        # formatBytes(), truncateAddress()
    └── errors.ts        # VaultSuiError class with error codes (E001-E012)

tests/
├── core/                # Unit tests for domain logic
│   ├── encrypt.test.ts
│   ├── compress.test.ts
│   ├── manifest.test.ts
│   ├── wallet.test.ts
│   ├── vault-id.test.ts
│   └── checksum.test.ts
├── commands/            # Unit tests for command handlers (mocked adapters)
│   ├── push.test.ts
│   ├── restore.test.ts
│   ├── list.test.ts
│   └── verify.test.ts
└── adapters/            # Unit tests for adapters (mocked SDK calls)
    ├── walrus.test.ts
    └── registry.test.ts
```

**Structure Decision**: Single project with hexagonal architecture. Commands handle orchestration, core modules contain pure domain logic, adapters wrap external I/O. This keeps core testable without mocking and adapters swappable.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
