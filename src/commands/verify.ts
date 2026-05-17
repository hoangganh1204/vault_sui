import { loadKeypair } from '../adapters/sui.js';
import { fetchBlob } from '../adapters/walrus.js';
import { loadRegistry } from '../adapters/registry.js';
import { parseManifest } from '../core/manifest.js';
import { validateVaultId } from '../core/vault-id.js';
import { getAddress } from '../core/wallet.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';
import * as logger from '../utils/logger.js';

export interface VerifyOptions {
  walletKey?: string;
}

export interface VerifyResult {
  vaultId: string;
  status: 'healthy' | 'corrupted';
  fileName: string;
  fileSize: number;
  createdAt: string;
  expiresAt: string;
  blobId?: string;
  error?: VaultSuiError;
}

export async function verifyCommand(vaultId: string, options: VerifyOptions): Promise<VerifyResult> {
  // 1. Validate vault ID format → E007
  if (!validateVaultId(vaultId)) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      `Invalid vault ID format: "${vaultId}"`,
      'Vault IDs must match the pattern v_XXXXXX (e.g. v_8f3k2m)'
    );
  }

  // 2. Validate wallet configured → E002
  const keypair = loadKeypair(options.walletKey);
  const walletAddress = getAddress(keypair);

  // 3. Look up vault in registry → E007 if not found
  const registry = await loadRegistry(walletAddress);
  const entry = registry.vaults.find((v) => v.vaultId === vaultId);
  if (!entry) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      `Vault "${vaultId}" not found in local registry`,
      'Run "vault-sui list" to see your vaults, or check the vault ID'
    );
  }

  const spin = logger.spinner('Verifying vault...');

  // 4. Fetch manifest blob
  let manifestBuffer: Buffer;
  try {
    manifestBuffer = await fetchBlob(entry.manifestBlobId);
  } catch (err) {
    spin.fail('Manifest unavailable');
    const blobError =
      err instanceof VaultSuiError
        ? err
        : new VaultSuiError(
            ERROR_CODES.BLOB_UNAVAILABLE,
            `Failed to fetch manifest blob: ${String(err)}`,
            'The vault may have expired or the network may be unavailable'
          );
    return {
      vaultId,
      status: 'corrupted',
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      error: blobError,
    };
  }

  // 5. Parse and validate manifest
  let manifest;
  try {
    manifest = parseManifest(manifestBuffer.toString('utf-8'));
  } catch (err) {
    spin.fail('Manifest invalid');
    const parseError =
      err instanceof VaultSuiError
        ? err
        : new VaultSuiError(
            ERROR_CODES.BLOB_UNAVAILABLE,
            `Failed to parse manifest: ${String(err)}`,
            'The vault manifest may be corrupted'
          );
    return {
      vaultId,
      status: 'corrupted',
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      error: parseError,
    };
  }

  // 6. Attempt to fetch data blob (availability check)
  try {
    await fetchBlob(manifest.blobId);
  } catch (err) {
    spin.fail('Data blob unavailable');
    const blobError =
      err instanceof VaultSuiError
        ? err
        : new VaultSuiError(
            ERROR_CODES.BLOB_UNAVAILABLE,
            `Failed to fetch data blob "${manifest.blobId}": ${String(err)}`,
            'The vault data may have expired or the network may be unavailable'
          );
    return {
      vaultId,
      status: 'corrupted',
      fileName: manifest.fileName,
      fileSize: manifest.fileSize,
      createdAt: manifest.createdAt,
      expiresAt: entry.expiresAt,
      error: blobError,
    };
  }

  spin.succeed(`Vault verified   ${vaultId}`);

  return {
    vaultId,
    status: 'healthy',
    fileName: manifest.fileName,
    fileSize: manifest.fileSize,
    createdAt: manifest.createdAt,
    expiresAt: entry.expiresAt,
    blobId: manifest.blobId,
  };
}
