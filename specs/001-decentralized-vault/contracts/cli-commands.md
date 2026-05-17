# CLI Command Contracts: VaultSui

**Date**: 2026-05-17

## Global Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--wallet-key <key>` | string | `$SUI_PRIVATE_KEY` | Sui private key (Bech32 or hex) |
| `--network <net>` | string | `"testnet"` | Network: `testnet` \| `mainnet` |
| `--help` | boolean | — | Show help with examples |
| `--version` | boolean | — | Show version |

---

## `vault-sui push <path>`

Encrypt and upload a file or directory to Walrus.

### Arguments

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `path` | string | Yes | Path to file or directory to backup |

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--allow <addresses>` | string | — | Comma-separated Sui addresses of authorized recipients |
| `--epochs <n>` | number | `3` | Number of Walrus storage epochs |

### Output (Success)

```
VaultSui 🔐
──────────────────────────────────────
✔ File read          4.2 KB
✔ Compressed         2.1 KB (50% reduction)
✔ Encrypted          AES-256-GCM
✔ Uploaded           blob stored on Walrus
✔ Manifest saved     2 wallets authorized

✅ Vault created successfully

  Vault ID:    v_8f3k2m
  File:        .env
  Size:        4.2 KB → 2.1 KB
  Owner:       0xABC...def
  Recipients:  2
  Expires:     2026-08-17
──────────────────────────────────────
```

### Output (Error)

```
VaultSui 🔐
──────────────────────────────────────
❌ Push failed: File not found

  Path: ./nonexistent.env
  Fix:  Check the file path and try again
  Code: E001
──────────────────────────────────────
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| E001 | FILE_NOT_FOUND | Specified path does not exist |
| E002 | WALLET_NOT_CONFIGURED | No wallet key provided |
| E003 | INVALID_ADDRESS | Wallet address format invalid |
| E005 | UPLOAD_FAILED | Walrus upload failed after 3 retries |
| E006 | COMPRESSION_FAILED | File compression failed |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (see error code in output) |

---

## `vault-sui restore <vault-id>`

Download and decrypt a vault to local filesystem.

### Arguments

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `vault-id` | string | Yes | Vault ID (format: `v_XXXXXX`) |

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--output <dir>` | string | `"."` | Output directory for restored file |

### Output (Success)

```
VaultSui 🔐
──────────────────────────────────────
✔ Manifest loaded    v_8f3k2m
✔ Wallet verified    0xABC...def authorized
✔ Downloaded         2.1 KB from Walrus
✔ Decrypted          AES-256-GCM
✔ Decompressed       4.2 KB restored
✔ Checksum verified  SHA-256 match ✓

✅ Vault restored successfully

  File:      .env
  Size:      4.2 KB
  Location:  ./restored/.env
  Checksum:  a1b2c3...
──────────────────────────────────────
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| E004 | UNAUTHORIZED | Wallet not in authorized list |
| E007 | VAULT_NOT_FOUND | Vault ID not found or manifest missing |
| E008 | VAULT_EXPIRED | Vault storage has expired |
| E009 | CHECKSUM_MISMATCH | Restored file checksum doesn't match (data NOT written to disk) |
| E010 | DOWNLOAD_FAILED | Walrus download failed after 3 retries |
| E011 | DECRYPTION_FAILED | AES decryption failed (wrong key or corrupted data) |

---

## `vault-sui list`

List all vaults created by the current wallet.

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output as JSON |

### Output (Success — Table)

```
VaultSui 🔐
──────────────────────────────────────
Your Vaults (3):

  ID         File         Size     Created      Status
  v_8f3k2m   .env         4.2 KB   2026-05-17   active
  v_j4n7p1   secrets.yml  12.0 KB  2026-05-15   active
  v_x9m2q5   config.json  1.1 KB   2026-04-01   expired
──────────────────────────────────────
```

### Output (Empty)

```
VaultSui 🔐
──────────────────────────────────────
No vaults found. Use 'vault-sui push <file>' to create your first vault.
──────────────────────────────────────
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| E002 | WALLET_NOT_CONFIGURED | No wallet key provided |

---

## `vault-sui verify <vault-id>`

Check vault integrity: blob exists on Walrus and manifest is valid.

### Arguments

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `vault-id` | string | Yes | Vault ID to verify |

### Output (Healthy)

```
VaultSui 🔐
──────────────────────────────────────
✅ Vault healthy

  Vault ID:    v_8f3k2m
  File:        .env
  Size:        4.2 KB
  Created:     2026-05-17
  Expires:     2026-08-17
  Blob:        available on Walrus
──────────────────────────────────────
```

### Output (Corrupted)

```
VaultSui 🔐
──────────────────────────────────────
❌ Vault corrupted

  Vault ID:  v_8f3k2m
  Issue:     Blob no longer available on Walrus network
  Fix:       Data may have expired or been lost. Re-push the original file.
  Code:      E012
──────────────────────────────────────
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| E007 | VAULT_NOT_FOUND | Vault ID not found |
| E012 | BLOB_UNAVAILABLE | Blob no longer exists on Walrus |
