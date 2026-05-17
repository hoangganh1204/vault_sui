# Quickstart: VaultSui Development

**Date**: 2026-05-17

## Prerequisites

- Node.js 18+ LTS
- npm or yarn
- A Sui wallet with testnet tokens (for Walrus storage fees)

## Project Setup

```bash
# Initialize project
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist

# Install dependencies
npm install commander@12 @mysten/sui @mysten/walrus chalk@5 ora@8 cli-table3 nanoid@5 archiver extract-zip
npm install --save-dev jest@29 ts-jest @types/jest @types/archiver eslint prettier

# Setup Jest
npx ts-jest config:init
```

## Project Structure

```
vault-sui/
├── src/
│   ├── commands/          # Command handlers (push, restore, list, verify)
│   │   ├── push.ts
│   │   ├── restore.ts
│   │   ├── list.ts
│   │   └── verify.ts
│   ├── core/              # Domain logic (no I/O dependencies)
│   │   ├── encrypt.ts     # AES-256-GCM encrypt/decrypt
│   │   ├── compress.ts    # zip compress/decompress
│   │   ├── manifest.ts    # Manifest create/parse/validate
│   │   ├── wallet.ts      # Wallet auth, signing, verification
│   │   ├── vault-id.ts    # Vault ID generation and validation
│   │   └── checksum.ts    # SHA-256 checksum compute/verify
│   ├── adapters/          # I/O adapters (Walrus, Sui, filesystem)
│   │   ├── walrus.ts      # Walrus SDK wrapper (upload/download)
│   │   ├── sui.ts         # Sui keypair and signing adapter
│   │   ├── fs.ts          # Local filesystem operations
│   │   └── registry.ts    # Local vault registry (~/.vaultsui/vaults.json)
│   ├── utils/
│   │   ├── logger.ts      # Centralized terminal output (chalk + ora)
│   │   ├── retry.ts       # Exponential backoff retry wrapper
│   │   ├── format.ts      # Formatting helpers (bytes, address truncation)
│   │   └── errors.ts      # Error codes and VaultSuiError class
│   └── index.ts           # CLI entry point (Commander setup)
├── tests/
│   ├── core/
│   │   ├── encrypt.test.ts
│   │   ├── compress.test.ts
│   │   ├── manifest.test.ts
│   │   ├── wallet.test.ts
│   │   ├── vault-id.test.ts
│   │   └── checksum.test.ts
│   ├── commands/
│   │   ├── push.test.ts
│   │   ├── restore.test.ts
│   │   ├── list.test.ts
│   │   └── verify.test.ts
│   └── adapters/
│       ├── walrus.test.ts
│       └── registry.test.ts
├── package.json
├── tsconfig.json
├── jest.config.ts
└── .eslintrc.json
```

## Key Architectural Decisions

### Hexagonal Architecture

```
Commands (CLI handlers)
    ↓ call
Core (domain logic — no I/O, no side effects)
    ↓ via interfaces
Adapters (Walrus SDK, Sui SDK, filesystem)
```

- **Commands** orchestrate the flow: parse CLI args → call core services → call adapters → format output
- **Core** is pure logic: encryption, compression, manifest handling, validation
- **Adapters** wrap external I/O: Walrus network, Sui blockchain, local filesystem

### Error Handling Pattern

```typescript
// src/utils/errors.ts
class VaultSuiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fix: string,
  ) {
    super(message);
    this.name = 'VaultSuiError';
  }
}

// Usage
throw new VaultSuiError('E001', 'File not found: .env', 'Check the file path and try again');
```

### Retry Pattern

```typescript
// src/utils/retry.ts — wraps any async fn with exponential backoff
const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // ms
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUI_PRIVATE_KEY` | Yes (or `--wallet-key`) | Sui private key (Bech32 or hex) |
| `VAULTSUI_NETWORK` | No | `testnet` (default) or `mainnet` |

## Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

## Development Workflow (TDD)

1. Write test for core module
2. Run test → verify it fails (red)
3. Implement minimum code to pass (green)
4. Refactor if needed
5. Repeat
