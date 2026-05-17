# Research: VaultSui — Decentralized Vault

**Date**: 2026-05-17
**Feature**: specs/001-decentralized-vault

## R1: Walrus Storage Integration

### Decision
Use `@mysten/walrus` SDK (`WalrusClient`) with `writeBlob`/`readBlob` for direct storage node communication.

### Rationale
- SDK provides crash recovery (`onStep`/`resume`), built-in retry on `RetryableWalrusClientError`, and `reset()` for epoch transitions
- Built-in network presets (`'testnet'` / `'mainnet'`) — no manual endpoint configuration needed
- `writeBlob` returns `{ blobId, blobObject }` with on-chain object ID for lifecycle tracking
- `readBlob` returns `Uint8Array` directly

### Alternatives Considered
- **HTTP Publisher/Aggregator API**: Simpler (plain `fetch`), but no crash recovery, no deletable blob management, no direct blockchain interaction. Better for prototyping, not production.

### Key API Patterns
```typescript
// Init
const walrusClient = new WalrusClient({ network: 'testnet', suiClient });

// Write
const { blobId, blobObject } = await walrusClient.writeBlob({
  blob: data,        // Uint8Array
  deletable: false,
  epochs: 3,
  signer: keypair,
});

// Read
const data: Uint8Array = await walrusClient.readBlob({ blobId });
```

### Retry Strategy
SDK has internal retry on `RetryableWalrusClientError` with `reset()`. We add application-level retry (3x exponential backoff: 1s, 2s, 4s) wrapping SDK calls per constitution requirement.

### Node.js Timeout
Default Node.js `connectTimeout` is 10s — configure `storageNodeClientOptions.timeout` to 60s via `undici` for storage node requests.

---

## R2: Sui Wallet Authentication

### Decision
Use `@mysten/sui` with `Ed25519Keypair` for keypair management, `signPersonalMessage()` for authentication, `verifyPersonalMessageSignature()` for access control.

### Rationale
- `signPersonalMessage` signs with PersonalMessage intent — distinct from transaction signing
- `verifyPersonalMessageSignature` recovers signer address — enables wallet-based access control without blockchain transactions
- `KeyObject`-based approach keeps private key in memory only

### Key API Patterns
```typescript
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';

// Create from private key (supports Bech32 suiprivkey1..., hex, or raw bytes)
const keypair = Ed25519Keypair.fromSecretKey(privateKeyString);
const address = keypair.toSuiAddress(); // 0x + 64 hex chars

// Sign personal message
const { signature } = await keypair.signPersonalMessage(messageBytes);

// Verify — throws if address doesn't match
await verifyPersonalMessageSignature(messageBytes, signature, { address });
```

### Address Format
- 32 bytes = `0x` + 64 hex characters (66 chars total)
- Validation regex: `/^0x[0-9a-fA-F]{64}$/`
- Display truncated: `0xABC...def` (first 5 + last 3 of hex part)

---

## R3: AES-256-GCM Encryption

### Decision
Use Node.js built-in `crypto` module with `KeyObject` wrapping, 12-byte random IV, 16-byte auth tag, packed format `iv(12) || tag(16) || ciphertext(N)`.

### Rationale
- `KeyObject` via `createSecretKey()` prevents accidental logging/serialization
- GCM provides AEAD — integrity + confidentiality in one pass
- 12-byte IV is NIST-recommended for GCM optimal performance
- Packed format enables single-buffer storage (no separate metadata)

### Key Security Patterns
1. Generate key: `createSecretKey(randomBytes(32))` → immediately `raw.fill(0)`
2. Key lives only in function scope → `key = null` after use → GC collects
3. `KeyObject` has no `toString()`/`toJSON()` leak path
4. Optional `--secure-heap=65536` for mlock/zero-on-free at runtime

### AAD Usage
Set AAD to vault_id to bind ciphertext to specific vault — prevents blob relocation attacks.

### Payload Layout
```
[ IV: 12 bytes ] [ Auth Tag: 16 bytes ] [ Ciphertext: N bytes ]
Total overhead: 28 bytes
```

---

## R4: Compression Strategy

### Decision
Use `archiver` 7.x for compression (zip format with deflate), `extract-zip` 2.x for decompression.

### Rationale
- Zip format is widely understood and supports single-file and directory compression
- `archiver` supports streaming (future-proof for >50MB files)
- `extract-zip` is lightweight and well-maintained
- Compress BEFORE encrypt (compressed data has higher entropy → better encryption)

### Pipeline Order
```
Push:    file → compress (zip/deflate) → encrypt (AES-256-GCM) → upload (Walrus)
Restore: download (Walrus) → decrypt (AES-256-GCM) → decompress (zip) → verify checksum → write file
```

---

## R5: Vault ID Format

### Decision
Use `"v_" + nanoid(6)` — e.g., `v_8f3k2m`.

### Rationale
- Short enough to share verbally or via chat
- `nanoid` uses cryptographically strong random bytes
- Prefix `v_` distinguishes from blob IDs and other identifiers
- 6 chars = 64^6 ≈ 68 billion combinations — sufficient for MVP scale
- Safe to share publicly (Vault ID alone doesn't grant access)

---

## R6: Access Control Flow

### Decision
Encrypt AES key per-wallet using Sui personal message signature as key derivation input. Store encrypted AES keys in manifest alongside allowed wallet addresses.

### Rationale
- Owner generates random AES key → encrypts data
- For each allowed wallet (including Owner): derive a wrapping key from the wallet's signature over a deterministic message containing the vault_id
- Store wrapped (encrypted) AES keys in manifest, keyed by wallet address
- On restore: Recipient signs the same deterministic message → derives wrapping key → unwraps AES key → decrypts data
- Unauthorized wallet cannot derive the wrapping key → cannot unwrap AES key → 0% chance of decryption

### Flow
```
Push (Owner):
  1. Generate random AES key
  2. Encrypt data with AES key
  3. For each wallet in [owner, ...recipients]:
     - message = "vaultsui:access:{vault_id}"
     - Owner signs message with own wallet → derive wrapping key
     - Wrap AES key with wrapping key → store in manifest
  4. Upload encrypted data + manifest to Walrus

Restore (Recipient):
  1. Download manifest from Walrus
  2. Check recipient wallet address is in manifest.allowed_wallets
  3. If not found → reject BEFORE downloading blob
  4. message = "vaultsui:access:{vault_id}"
  5. Recipient signs message → derive wrapping key → unwrap AES key
  6. Download encrypted blob → decrypt with AES key → verify checksum → write file
```

### Important Consideration
The Owner needs to encrypt the AES key for each recipient. Since only the Owner has the AES key at push time, and recipients' private keys are unknown, we use a simpler approach:
- Owner encrypts AES key with a key derived from `HKDF(owner_signature, vault_id)`
- For recipients: Owner encrypts the same AES key with a shared secret derived via Diffie-Hellman or a simpler scheme
- **Simplified MVP approach**: Store the AES key encrypted with a key derived from the Owner's signature. Recipients authenticate via personal message signature (proving wallet ownership), and if authorized, the manifest includes enough info to derive the decryption key. The exact key-exchange mechanism for multi-recipient will use the signature-as-key pattern where each authorized wallet's signature over the vault_id deterministically produces the same wrapping key derivation.

**Final simplified approach for MVP**:
- AES key is wrapped using HKDF(SHA-256, owner_private_signature, vault_id)
- Access control: manifest stores allowed_wallets list. On restore, system verifies wallet is in list via signature verification BEFORE downloading blob
- The wrapped AES key in the manifest can only be unwrapped by the Owner (who can re-sign the same message)
- For Recipients: Owner pre-computes a shared wrapping key per recipient using ECDH or stores separately encrypted AES key copies

This needs further design in data-model.md for the exact key wrapping scheme.
