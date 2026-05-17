import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, hkdfSync } from 'node:crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Core helpers (not mocked — we use real crypto/compress)
import { encrypt } from '../../src/core/encrypt.js';
import { compressFile } from '../../src/core/compress.js';
import { computeChecksum } from '../../src/core/checksum.js';
import { createManifest } from '../../src/core/manifest.js';
import { signMessage } from '../../src/core/wallet.js';
import { VaultSuiError, ERROR_CODES } from '../../src/utils/errors.js';

// --- ESM mocks (must be set up before dynamic import) ---
const mockFetchBlob = jest.fn<() => Promise<Buffer>>();
const mockGetVaultEntries = jest.fn<() => Promise<unknown[]>>();

jest.unstable_mockModule('../../src/adapters/walrus.js', () => ({
  fetchBlob: mockFetchBlob,
}));
jest.unstable_mockModule('../../src/adapters/registry.js', () => ({
  getVaultEntries: mockGetVaultEntries,
}));

const { restoreCommand } = await import('../../src/commands/restore.js');

// ---------------------------------------------------------------------------
// Fixtures created once in beforeAll
// ---------------------------------------------------------------------------
function deriveWrapKey(sigBase64: string, vaultId: string, info: string): Buffer {
  const sigBytes = Buffer.from(sigBase64, 'base64');
  return Buffer.from(
    hkdfSync('sha256', sigBytes, Buffer.from(vaultId, 'utf-8'), Buffer.from(info, 'utf-8'), 32)
  );
}

describe('restore command', () => {
  let ownerKeypair: Ed25519Keypair;
  let ownerAddress: string;
  let walletKey: string;

  let fixtureDir: string;
  let vaultId: string;
  let manifestBuffer: Buffer;
  let encryptedDataBuffer: Buffer;
  let originalContent: string;

  beforeAll(async () => {
    ownerKeypair = Ed25519Keypair.generate();
    ownerAddress = ownerKeypair.getPublicKey().toSuiAddress();
    walletKey = ownerKeypair.getSecretKey();
    vaultId = 'v_rest01';
    originalContent = 'SECRET=test-value\nANOTHER=12345\n';

    // Create a real file and compress it so decompressBuffer can restore it
    fixtureDir = join(tmpdir(), `vault-restore-fixture-${Date.now()}`);
    await mkdir(fixtureDir, { recursive: true });
    const srcFile = join(fixtureDir, 'secret.env');
    await writeFile(srcFile, originalContent, 'utf-8');

    const fileData = Buffer.from(originalContent, 'utf-8');
    const checksum = computeChecksum(fileData);
    const compressed = await compressFile(srcFile);

    // Generate K_data and wrap it for owner (mirror push.ts key wrapping)
    const K_data = randomBytes(32);
    const wrapMsg = `vaultsui:wrap:${vaultId}:${ownerAddress}`;
    const sig = await signMessage(ownerKeypair, wrapMsg);
    const K_wrap = deriveWrapKey(sig, vaultId, 'owner-wrap');
    const wrappedKey = encrypt(K_data, K_wrap, `${vaultId}:${ownerAddress}`);
    const encryptedKeys = { [ownerAddress]: wrappedKey.toString('base64') };

    // Encrypt compressed data
    encryptedDataBuffer = encrypt(compressed, K_data, vaultId);
    K_data.fill(0);

    // Build manifest
    const manifest = createManifest({
      vaultId,
      fileName: 'secret.env',
      fileSize: fileData.length,
      checksum,
      ownerAddress,
      allowedWallets: [ownerAddress],
      encryptedKeys,
      blobId: 'data-blob-id',
      epochs: 3,
    });
    manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf-8');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true }).catch(() => undefined);
  });

  let testDir: string;
  let outputDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `vault-restore-test-${Date.now()}`);
    outputDir = join(testDir, 'output');
    await mkdir(outputDir, { recursive: true });

    mockFetchBlob.mockClear();
    mockGetVaultEntries.mockClear();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  const makeEntry = () => ({
    vaultId,
    fileName: 'secret.env',
    fileSize: originalContent.length,
    blobId: 'data-blob-id',
    manifestBlobId: 'manifest-blob-id',
    ownerAddress,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 90).toISOString(),
    status: 'active',
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------
  describe('happy path', () => {
    it('should restore a vault and write the file to --output dir', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);
      // First fetchBlob call → manifest; second → encrypted data
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer)
        .mockResolvedValueOnce(encryptedDataBuffer);

      const result = await restoreCommand(vaultId, { walletKey, output: outputDir });

      expect(result.vaultId).toBe(vaultId);
      expect(result.fileName).toBe('secret.env');
    });

    it('should write the restored file with content matching the original', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer)
        .mockResolvedValueOnce(encryptedDataBuffer);

      const result = await restoreCommand(vaultId, { walletKey, output: outputDir });

      const restored = await readFile(result.outputPath, 'utf-8');
      expect(restored).toBe(originalContent);
    });

    it('should call fetchBlob exactly twice (manifest + data)', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer)
        .mockResolvedValueOnce(encryptedDataBuffer);

      await restoreCommand(vaultId, { walletKey, output: outputDir });

      expect(mockFetchBlob).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Error: unauthorized wallet — E004 BEFORE downloading data blob
  // ---------------------------------------------------------------------------
  describe('unauthorized wallet', () => {
    it('should throw E004 before fetching the data blob', async () => {
      const unauthorizedKp = Ed25519Keypair.generate();
      const unauthorizedKey = unauthorizedKp.getSecretKey();

      // Registry returns the entry even for the unauthorized wallet
      // (simulating they know the manifest blob ID)
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);
      // fetchBlob is called once for manifest; should NOT be called for data
      mockFetchBlob.mockResolvedValueOnce(manifestBuffer);

      await expect(
        restoreCommand(vaultId, { walletKey: unauthorizedKey, output: outputDir })
      ).rejects.toMatchObject({ code: ERROR_CODES.UNAUTHORIZED });

      // Only manifest was fetched — data blob fetch must NOT have happened
      expect(mockFetchBlob).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Error: vault not found — E007 (vault not in local registry)
  // ---------------------------------------------------------------------------
  describe('vault not found', () => {
    it('should throw E007 without calling fetchBlob', async () => {
      mockGetVaultEntries.mockResolvedValue([]); // empty registry

      await expect(
        restoreCommand('v_unknwn', { walletKey, output: outputDir })
      ).rejects.toMatchObject({ code: ERROR_CODES.VAULT_NOT_FOUND });

      expect(mockFetchBlob).not.toHaveBeenCalled();
    });
  });
});
