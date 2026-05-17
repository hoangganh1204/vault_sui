import { randomBytes, hkdfSync } from 'node:crypto';
import { basename } from 'node:path';
import { loadKeypair } from '../adapters/sui.js';
import { storeBlob } from '../adapters/walrus.js';
import { readFileAsync } from '../adapters/fs.js';
import { addVaultEntry } from '../adapters/registry.js';
import { compressFile } from '../core/compress.js';
import { computeChecksum } from '../core/checksum.js';
import { encrypt } from '../core/encrypt.js';
import { generateVaultId } from '../core/vault-id.js';
import { createManifest } from '../core/manifest.js';
import { getAddress, signMessage, validateSuiAddress } from '../core/wallet.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';
import * as logger from '../utils/logger.js';
import { formatBytes } from '../utils/format.js';

export interface PushOptions {
  walletKey?: string;
  allow?: string[];
  epochs?: number;
}

export interface PushResult {
  vaultId: string;
  fileName: string;
  fileSize: number;
  compressedSize: number;
  ownerAddress: string;
  allowedWallets: string[];
  dataBlobId: string;
  manifestBlobId: string;
  createdAt: string;
  expiresAt: string;
}

function deriveWrapKey(sigBase64: string, vaultId: string, info: string): Buffer {
  const sigBytes = Buffer.from(sigBase64, 'base64');
  return Buffer.from(
    hkdfSync('sha256', sigBytes, Buffer.from(vaultId, 'utf-8'), Buffer.from(info, 'utf-8'), 32)
  );
}

export async function pushCommand(filePath: string, options: PushOptions): Promise<PushResult> {
  const epochs = options.epochs ?? 3;

  // 1. Validate wallet — throws E002 if not configured
  const keypair = loadKeypair(options.walletKey);
  const ownerAddress = getAddress(keypair);

  // 2. Validate recipient addresses — throws E003 for invalid addresses
  const recipients = (options.allow ?? []).filter((a) => a !== ownerAddress);
  for (const addr of recipients) {
    if (!validateSuiAddress(addr)) {
      throw new VaultSuiError(
        ERROR_CODES.INVALID_ADDRESS,
        `Invalid recipient address: "${addr}"`,
        'Provide a valid Sui address (0x followed by 64 hex characters)'
      );
    }
  }
  const allWallets = [ownerAddress, ...recipients];

  // 3. Read file — throws E001 if not found
  let fileData: Buffer;
  try {
    fileData = await readFileAsync(filePath);
  } catch (err) {
    if (err instanceof VaultSuiError) throw err;
    throw new VaultSuiError(
      ERROR_CODES.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      'Check the file path and try again'
    );
  }

  const fileSize = fileData.length;
  const fileName = basename(filePath);
  logger.step('File read', formatBytes(fileSize));

  // 4. Compute checksum before any transformation
  const checksum = computeChecksum(fileData);

  // 5. Generate vault ID
  const vaultId = generateVaultId();

  // 6. Compress
  const compressed = await compressFile(filePath);
  logger.step('Compressed', formatBytes(compressed.length));

  // 7. Encrypt with random AES-256 key (K_data)
  const K_data = randomBytes(32);
  const encryptedData = encrypt(compressed, K_data, vaultId);
  logger.step('Encrypted', 'AES-256-GCM');

  // 8. Wrap K_data per wallet using owner's deterministic signatures
  const encryptedKeys: Record<string, string> = {};
  for (const wallet of allWallets) {
    const wrapMsg = `vaultsui:wrap:${vaultId}:${wallet}`;
    const sig = await signMessage(keypair, wrapMsg);
    const info = wallet === ownerAddress ? 'owner-wrap' : 'recipient-wrap';
    const K_wrap = deriveWrapKey(sig, vaultId, info);
    const wrappedKey = encrypt(K_data, K_wrap, `${vaultId}:${wallet}`);
    encryptedKeys[wallet] = wrappedKey.toString('base64');
  }
  // Zero out K_data from memory
  K_data.fill(0);

  // 9. Upload encrypted data blob
  const spin = logger.spinner('Uploading data to Walrus...');
  const dataBlobId = await storeBlob(encryptedData, keypair, epochs);
  spin.succeed(`Uploaded     blob stored on Walrus (${dataBlobId.slice(0, 16)}...)`);

  // 10. Create and upload manifest
  const manifest = createManifest({
    vaultId,
    fileName,
    fileSize,
    checksum,
    ownerAddress,
    allowedWallets: allWallets,
    encryptedKeys,
    blobId: dataBlobId,
    epochs,
  });
  const manifestBytes = Buffer.from(JSON.stringify(manifest), 'utf-8');
  const mSpin = logger.spinner('Saving manifest...');
  const manifestBlobId = await storeBlob(manifestBytes, keypair, epochs);
  mSpin.succeed(`Manifest saved   ${allWallets.length} wallet(s) authorized`);

  // 11. Add to local registry
  const createdAt = manifest.createdAt;
  const expiresAt = new Date(Date.now() + 86400000 * 30 * epochs).toISOString();
  await addVaultEntry(
    {
      vaultId,
      fileName,
      fileSize,
      blobId: dataBlobId,
      manifestBlobId,
      ownerAddress,
      createdAt,
      expiresAt,
      status: 'active',
    },
    ownerAddress
  );

  return {
    vaultId,
    fileName,
    fileSize,
    compressedSize: compressed.length,
    ownerAddress,
    allowedWallets: allWallets,
    dataBlobId,
    manifestBlobId,
    createdAt,
    expiresAt,
  };
}
