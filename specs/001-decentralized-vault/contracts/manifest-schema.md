# Manifest Schema Contract: VaultSui

**Date**: 2026-05-17
**Schema Version**: 1

## Manifest JSON Schema

```json
{
  "version": 1,
  "vaultId": "v_8f3k2m",
  "fileName": ".env",
  "fileSize": 4200,
  "checksum": "a1b2c3d4e5f6...64_hex_chars",
  "compressionAlgo": "deflate",
  "encryptionAlgo": "aes-256-gcm",
  "ownerAddress": "0x1234...64_hex_chars",
  "allowedWallets": [
    "0x1234...owner",
    "0xabcd...recipient1",
    "0xef01...recipient2"
  ],
  "encryptedKeys": {
    "0x1234...owner": "base64_encoded_wrapped_aes_key",
    "0xabcd...recipient1": "base64_encoded_wrapped_aes_key",
    "0xef01...recipient2": "base64_encoded_wrapped_aes_key"
  },
  "blobId": "walrus_blob_id_string",
  "createdAt": "2026-05-17T10:30:00.000Z",
  "epochs": 3
}
```

## Field Specifications

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| version | number | Yes | Must be >= 1 |
| vaultId | string | Yes | Must match `/^v_[A-Za-z0-9_-]{6}$/` |
| fileName | string | Yes | Non-empty, no path traversal |
| fileSize | number | Yes | Must be > 0 |
| checksum | string | Yes | 64-char hex (SHA-256) |
| compressionAlgo | string | Yes | `"deflate"` |
| encryptionAlgo | string | Yes | `"aes-256-gcm"` |
| ownerAddress | string | Yes | Sui address format |
| allowedWallets | string[] | Yes | Non-empty, each valid Sui address, must include ownerAddress |
| encryptedKeys | Record<string, string> | Yes | Key per allowedWallet, base64 values |
| blobId | string | Yes | Non-empty |
| createdAt | string | Yes | ISO 8601 |
| epochs | number | Yes | Must be >= 1 |

## Versioning Rules

- `version` field MUST be present in every manifest
- Readers MUST reject manifests with `version` > their supported version
- New fields MAY be added in future versions without incrementing version (additive changes)
- Removing or changing field semantics REQUIRES version increment

## VaultRegistry JSON Schema

File: `~/.vaultsui/vaults.json`

```json
{
  "version": 1,
  "walletAddress": "0x1234...owner",
  "vaults": [
    {
      "vaultId": "v_8f3k2m",
      "fileName": ".env",
      "fileSize": 4200,
      "blobId": "walrus_blob_id",
      "manifestBlobId": "walrus_manifest_blob_id",
      "ownerAddress": "0x1234...owner",
      "createdAt": "2026-05-17T10:30:00.000Z",
      "expiresAt": "2026-08-17T10:30:00.000Z",
      "status": "active"
    }
  ]
}
```
