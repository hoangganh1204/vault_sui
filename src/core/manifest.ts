import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';
import { validateVaultId } from './vault-id.js';
import { validateSuiAddress } from './wallet.js';

export interface Manifest {
  version: number;
  vaultId: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  compressionAlgo: 'deflate';
  encryptionAlgo: 'aes-256-gcm';
  ownerAddress: string;
  allowedWallets: string[];
  encryptedKeys: Record<string, string>;
  blobId: string;
  createdAt: string;
  epochs: number;
}

export interface CreateManifestParams {
  vaultId: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  ownerAddress: string;
  allowedWallets: string[];
  encryptedKeys: Record<string, string>;
  blobId: string;
  epochs: number;
}

export function createManifest(params: CreateManifestParams): Manifest {
  return {
    version: 1,
    vaultId: params.vaultId,
    fileName: params.fileName,
    fileSize: params.fileSize,
    checksum: params.checksum,
    compressionAlgo: 'deflate',
    encryptionAlgo: 'aes-256-gcm',
    ownerAddress: params.ownerAddress,
    allowedWallets: params.allowedWallets,
    encryptedKeys: params.encryptedKeys,
    blobId: params.blobId,
    createdAt: new Date().toISOString(),
    epochs: params.epochs,
  };
}

export function parseManifest(json: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Failed to parse manifest: invalid JSON',
      'The manifest data may be corrupted'
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Manifest is not an object',
      'The manifest data may be corrupted'
    );
  }
  const manifest = parsed as Manifest;
  validateManifest(manifest);
  return manifest;
}

export function validateManifest(manifest: Manifest): void {
  if (manifest.version === undefined || manifest.version < 1) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: version must be >= 1',
      'The manifest may be from an unsupported version'
    );
  }
  if (!validateVaultId(manifest.vaultId)) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      `Invalid manifest: invalid vaultId "${manifest.vaultId}"`,
      'The manifest data may be corrupted'
    );
  }
  if (!manifest.fileName || manifest.fileName.includes('..')) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: fileName is empty or contains path traversal',
      'The manifest data may be corrupted'
    );
  }
  if (typeof manifest.fileSize !== 'number' || manifest.fileSize <= 0) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: fileSize must be > 0',
      'The manifest data may be corrupted'
    );
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.checksum)) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: checksum must be 64-char hex',
      'The manifest data may be corrupted'
    );
  }
  if (!validateSuiAddress(manifest.ownerAddress)) {
    throw new VaultSuiError(
      ERROR_CODES.INVALID_ADDRESS,
      `Invalid manifest: ownerAddress "${manifest.ownerAddress}" is not a valid Sui address`,
      'The manifest data may be corrupted'
    );
  }
  if (
    !Array.isArray(manifest.allowedWallets) ||
    manifest.allowedWallets.length === 0 ||
    !manifest.allowedWallets.includes(manifest.ownerAddress)
  ) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: allowedWallets must be non-empty and include ownerAddress',
      'The manifest data may be corrupted'
    );
  }
  for (const wallet of manifest.allowedWallets) {
    if (!validateSuiAddress(wallet)) {
      throw new VaultSuiError(
        ERROR_CODES.INVALID_ADDRESS,
        `Invalid manifest: "${wallet}" is not a valid Sui address`,
        'The manifest data may be corrupted'
      );
    }
  }
  if (!manifest.blobId) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: blobId is required',
      'The manifest data may be corrupted'
    );
  }
  if (typeof manifest.epochs !== 'number' || manifest.epochs < 1) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      'Invalid manifest: epochs must be >= 1',
      'The manifest data may be corrupted'
    );
  }
}
