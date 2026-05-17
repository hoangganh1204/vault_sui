import { hkdfSync } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadKeypair } from '../adapters/sui.js';
import { fetchBlob } from '../adapters/walrus.js';
import { writeFileAsync, ensureDir, readFileAsync } from '../adapters/fs.js';
import { getVaultEntries } from '../adapters/registry.js';
import { decrypt } from '../core/encrypt.js';
import { decompressBuffer } from '../core/compress.js';
import { parseManifest } from '../core/manifest.js';
import { verifyChecksum } from '../core/checksum.js';
import { validateVaultId } from '../core/vault-id.js';
import { getAddress, signMessage } from '../core/wallet.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { formatBytes, truncateAddress } from '../utils/format.js';

export interface RestoreOptions {
  walletKey?: string;
  output?: string;
}

export interface RestoreResult {
  vaultId: string;
  fileName: string;
  fileSize: number;
  outputPath: string;
  checksum: string;
}

function deriveWrapKey(sigBase64: string, vaultId: string, info: string): Buffer {
  const sigBytes = Buffer.from(sigBase64, 'base64');
  return Buffer.from(
    hkdfSync('sha256', sigBytes, Buffer.from(vaultId, 'utf-8'), Buffer.from(info, 'utf-8'), 32)
  );
}

export async function restoreCommand(
  vaultId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  // 1. Validate vault ID format
  if (!validateVaultId(vaultId)) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      `Invalid vault ID format: "${vaultId}"`,
      'Vault IDs must match the pattern v_XXXXXX (e.g. v_8f3k2m)'
    );
  }

  // 2. Load wallet (throws E002 if not configured)
  const keypair = loadKeypair(options.walletKey);
  const walletAddress = getAddress(keypair);

  // 3. Look up manifest blob ID from local registry → E007 if not found
  const entries = await getVaultEntries(walletAddress);
  const entry = entries.find((e) => (e as { vaultId: string }).vaultId === vaultId) as
    | { vaultId: string; manifestBlobId: string; blobId: string }
    | undefined;

  if (!entry) {
    throw new VaultSuiError(
      ERROR_CODES.VAULT_NOT_FOUND,
      `Vault "${vaultId}" not found in local registry`,
      'Run "vault-sui list" to see your vaults, or check the vault ID'
    );
  }

  // 4. Fetch manifest
  const mSpin = logger.spinner('Loading manifest...');
  const manifestBytes = await fetchBlob(entry.manifestBlobId);
  const manifest = parseManifest(manifestBytes.toString('utf-8'));
  mSpin.succeed(`Manifest loaded   ${vaultId}`);

  // 5. Authorization check BEFORE fetching data blob (important: reject E004 here)
  if (!manifest.allowedWallets.includes(walletAddress)) {
    throw new VaultSuiError(
      ERROR_CODES.UNAUTHORIZED,
      `Wallet ${truncateAddress(walletAddress)} is not authorized to restore vault "${vaultId}"`,
      'Request access from the vault owner'
    );
  }
  logger.step('Wallet verified', `${truncateAddress(walletAddress)} authorized`);

  // 6. Unwrap K_data using wallet's deterministic signature (mirrors push key wrapping)
  const wrappedKeyBase64 = manifest.encryptedKeys[walletAddress];
  if (!wrappedKeyBase64) {
    throw new VaultSuiError(
      ERROR_CODES.UNAUTHORIZED,
      `No encrypted key found for wallet ${truncateAddress(walletAddress)}`,
      'Ask the vault owner to re-push with your address in --allow'
    );
  }

  const wrapMsg = `vaultsui:wrap:${vaultId}:${walletAddress}`;
  const sig = await signMessage(keypair, wrapMsg);
  const info = walletAddress === manifest.ownerAddress ? 'owner-wrap' : 'recipient-wrap';
  const K_wrap = deriveWrapKey(sig, vaultId, info);
  const wrappedKeyBuffer = Buffer.from(wrappedKeyBase64, 'base64');
  const K_data = decrypt(wrappedKeyBuffer, K_wrap, `${vaultId}:${walletAddress}`);

  // 7. Fetch encrypted data blob
  const dSpin = logger.spinner('Downloading encrypted data...');
  const encryptedData = await fetchBlob(manifest.blobId);
  dSpin.succeed(`Downloaded   ${formatBytes(encryptedData.length)} from Walrus`);

  // 8. Decrypt
  const compressed = decrypt(encryptedData, K_data, vaultId);
  K_data.fill(0);
  logger.step('Decrypted', 'AES-256-GCM');

  // 9. Decompress to a temp directory first
  const tmpDir = join(options.output ?? '.', `.vaultsui-tmp-${randomBytes(4).toString('hex')}`);
  await ensureDir(tmpDir);
  await decompressBuffer(compressed, tmpDir);
  logger.step('Decompressed', formatBytes(manifest.fileSize));

  // 10. Read the restored file and verify checksum — do NOT write to final path yet
  const tmpFilePath = join(tmpDir, manifest.fileName);
  const restoredData = await readFileAsync(tmpFilePath);

  if (!verifyChecksum(restoredData, manifest.checksum)) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    throw new VaultSuiError(
      ERROR_CODES.CHECKSUM_MISMATCH,
      'Checksum verification failed — the data does not match the original',
      'The vault may be corrupted. Contact the vault owner.'
    );
  }
  logger.step('Checksum verified', 'SHA-256 match ✓');

  // 11. Write to the final output path (checksum OK)
  const outputDir = options.output ?? '.';
  await ensureDir(outputDir);
  const outputPath = join(outputDir, manifest.fileName);
  await writeFileAsync(outputPath, restoredData);

  // Clean up temp dir
  await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);

  return {
    vaultId,
    fileName: manifest.fileName,
    fileSize: manifest.fileSize,
    outputPath,
    checksum: manifest.checksum,
  };
}
