# Data Model: VaultSui

**Date**: 2026-05-17
**Feature**: specs/001-decentralized-vault

## Entities

### Vault

The primary unit of storage. Represents one encrypted backup of a file or directory.

| Field | Type | Description |
|-------|------|-------------|
| vaultId | string | Unique identifier, format: `v_` + nanoid(6). Example: `v_8f3k2m` |
| fileName | string | Original file/directory name |
| fileSize | number | Original uncompressed size in bytes |
| checksum | string | SHA-256 hash of original file content (hex) |
| blobId | string | Walrus blob ID for the encrypted+compressed data |
| blobObjectId | string | Sui on-chain object ID of the blob (for lifecycle tracking) |
| ownerAddress | string | Sui address of the vault creator (0x + 64 hex) |
| allowedWallets | string[] | List of Sui addresses authorized to restore (includes owner) |
| createdAt | string | ISO 8601 timestamp of vault creation |
| expiresAt | string | ISO 8601 timestamp of storage expiration (based on Walrus epochs) |
| epochs | number | Number of Walrus storage epochs paid for |

### Manifest

Metadata stored alongside the encrypted blob on Walrus. Enables self-describing vaults for portability.

| Field | Type | Description |
|-------|------|-------------|
| version | number | Schema version for forward-compatibility (starts at 1) |
| vaultId | string | Vault identifier |
| fileName | string | Original file name |
| fileSize | number | Original file size in bytes |
| checksum | string | SHA-256 of original content |
| compressionAlgo | string | Compression algorithm used (e.g., `"deflate"`) |
| encryptionAlgo | string | Encryption algorithm used (`"aes-256-gcm"`) |
| ownerAddress | string | Owner's Sui address |
| allowedWallets | string[] | Authorized wallet addresses |
| encryptedKeys | Record<string, string> | Map of wallet address → base64-encoded wrapped AES key |
| blobId | string | Walrus blob ID of the encrypted data |
| createdAt | string | ISO 8601 creation timestamp |
| epochs | number | Storage epochs |

### VaultRegistry (Local)

Local file at `~/.vaultsui/vaults.json`. Cache of vault metadata for fast `list` command. Not sensitive — contains no keys.

| Field | Type | Description |
|-------|------|-------------|
| version | number | Registry schema version (starts at 1) |
| walletAddress | string | Current wallet's Sui address |
| vaults | VaultEntry[] | Array of vault entries |

### VaultEntry (within VaultRegistry)

| Field | Type | Description |
|-------|------|-------------|
| vaultId | string | Vault identifier |
| fileName | string | Original file name |
| fileSize | number | Original file size |
| blobId | string | Walrus blob ID |
| manifestBlobId | string | Walrus blob ID of the manifest |
| ownerAddress | string | Owner Sui address |
| createdAt | string | ISO 8601 timestamp |
| expiresAt | string | Estimated expiration timestamp |
| status | string | `"active"` \| `"expired"` \| `"unknown"` |

## Relationships

```
Owner (wallet) ──creates──> Vault ──contains──> Manifest
                                  ──references──> Blob (encrypted data on Walrus)
                                  ──authorizes──> Recipient[] (wallet addresses)

VaultRegistry (local) ──caches──> VaultEntry[] (metadata only)
```

## Validation Rules

| Entity | Rule | Source |
|--------|------|--------|
| vaultId | Must match `/^v_[A-Za-z0-9_-]{6}$/` | Convention |
| ownerAddress | Must match `/^0x[0-9a-fA-F]{64}$/` | FR-011, Sui standard |
| allowedWallets[*] | Each must match Sui address format | FR-011 |
| checksum | Must be 64-char hex string (SHA-256) | FR-005 |
| fileSize | Must be > 0 | FR-011 |
| fileName | Must not be empty, must not contain path traversal (`..`) | FR-011, Security |
| version (manifest) | Must be >= 1 | FR-008 |
| epochs | Must be >= 1 | FR-008 |

## State Transitions

### Vault Lifecycle

```
[created] ──push success──> [active]
[active]  ──epoch expires──> [expired]
[active]  ──blob lost──>    [corrupted]
[active]  ──verify ok──>    [active] (confirmed)
```

### Restore Flow States

```
[requested] ──check wallet──> [authorized] / [rejected]
[authorized] ──download──> [downloaded]
[downloaded] ──decrypt──> [decrypted]
[decrypted] ──verify checksum──> [verified] / [corrupted]
[verified] ──write to disk──> [complete]
[corrupted] ──abort──> [failed] (no file written to disk)
```

## Key Wrapping Scheme (Access Control)

### Push (Owner creates vault)

1. Generate random AES-256 key (`K_data`)
2. Compress + encrypt file with `K_data`
3. For each authorized wallet address `W_i`:
   - Owner signs message: `"vaultsui:wrap:{vaultId}:{W_i}"` → `sig_i`
   - Derive wrapping key: `K_wrap_i = HKDF-SHA256(ikm=sig_i, salt=vaultId, info="aes-key-wrap")`
   - Wrap: `encrypted_key_i = AES-256-GCM(K_wrap_i, K_data)`
   - Store in manifest: `encryptedKeys[W_i] = base64(encrypted_key_i)`
4. Upload encrypted data blob + manifest blob to Walrus
5. Discard `K_data` from memory

### Restore (Recipient unwraps key)

1. Download manifest from Walrus
2. Check `wallet_address ∈ manifest.allowedWallets` → reject if not found
3. Request Owner to provide the wrapped key for this recipient
   - **MVP simplification**: Owner wraps key for each recipient at push time. Recipient authenticates via personal message signature to prove wallet ownership. The wrapped key specific to their address is in the manifest.
4. But: Only the Owner's signature was used to derive wrapping keys → Recipient cannot independently derive `K_wrap_i` because they don't have the Owner's signature output.

### Revised Approach (Practical MVP)

Since recipients don't have the Owner's private key, the key wrapping scheme must use a mechanism where each recipient can independently derive their wrapping key:

1. **Owner generates `K_data`** (random AES-256 key)
2. **For Owner**: Wrap `K_data` using key derived from Owner's own signature
3. **For each Recipient**:
   - Owner generates a per-recipient secret: `R_secret_i = HKDF(K_data, salt=W_i, info="recipient-share")`
   - Owner encrypts `K_data` using `R_secret_i` as wrapping key
   - The `R_secret_i` is then encrypted using the Recipient's public key (X25519 key exchange)
   - **Simpler alternative**: Use Sui's Ed25519 keys to perform X25519 Diffie-Hellman key agreement between Owner and each Recipient

4. **Simplest MVP approach** (recommended):
   - Owner wraps `K_data` once with a vault-specific passphrase derived from Owner's signature
   - Manifest stores `encryptedKeys.owner` = wrapped key
   - Access control is enforced at the manifest level: `allowedWallets` list
   - On restore: system verifies Recipient's wallet is in `allowedWallets` via signature verification
   - If authorized: Owner must have pre-shared the wrapping passphrase, OR the system uses a re-encryption approach

   **Final MVP decision**:
   - Single encrypted key in manifest, wrapped with vault-specific key derived from a deterministic message signed by Owner
   - Recipients authenticate via `signPersonalMessage("vaultsui:auth:{vaultId}")` — system verifies their address is in `allowedWallets`
   - If authorized, the encrypted blob is downloaded and the AES key is unwrapped using the Owner's stored wrapped key (requires Owner to perform the unwrap, or a key escrow mechanism)

   **Practical simplification for MVP**:
   - AES key is derived deterministically: `K_data = HKDF-SHA256(ikm=owner_signature("vaultsui:key:{vaultId}"), salt=vaultId, info="data-key")`
   - This means Owner can always re-derive the key by re-signing the same message
   - For recipients: Owner creates a "share" by encrypting `K_data` with a key derived from ECDH between Owner's and Recipient's public keys
   - Each share is stored in `manifest.encryptedKeys[recipientAddress]`
   - Recipient derives the shared secret via ECDH (their private key + Owner's public key) → unwrap `K_data`
   - This works because Ed25519 keys can be converted to X25519 for Diffie-Hellman

### Final Key Exchange Design

```
Push:
  1. K_data = randomBytes(32)  // random AES key
  2. Encrypt file with K_data
  3. For Owner:
     ownerSig = sign("vaultsui:key:{vaultId}")
     K_owner = HKDF(ownerSig, vaultId, "owner-wrap")
     encryptedKeys["owner"] = AES-GCM(K_owner, K_data)
  4. For each Recipient W_i:
     sharedSecret = X25519(ownerPrivateKey, recipientPublicKey_i)
     K_recipient_i = HKDF(sharedSecret, vaultId, "recipient-wrap")
     encryptedKeys[W_i] = AES-GCM(K_recipient_i, K_data)
  5. Upload blob + manifest
  6. Discard K_data

Restore (Owner):
  1. Re-sign "vaultsui:key:{vaultId}" → re-derive K_owner → unwrap K_data

Restore (Recipient):
  1. Verify wallet in allowedWallets (reject if not)
  2. sharedSecret = X25519(recipientPrivateKey, ownerPublicKey)
  3. K_recipient = HKDF(sharedSecret, vaultId, "recipient-wrap")
  4. Unwrap K_data from encryptedKeys[myAddress]
  5. Decrypt file
```
