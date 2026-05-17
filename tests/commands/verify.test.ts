import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createManifest } from '../../src/core/manifest.js';
import { VaultSuiError, ERROR_CODES } from '../../src/utils/errors.js';
import type { VaultEntry } from '../../src/adapters/registry.js';

// ESM-compatible mocking — must use jest.unstable_mockModule before dynamic imports
const mockFetchBlob = jest.fn<() => Promise<Buffer>>();
const mockLoadRegistry = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../src/adapters/walrus.js', () => ({
  fetchBlob: mockFetchBlob,
}));
jest.unstable_mockModule('../../src/adapters/registry.js', () => ({
  loadRegistry: mockLoadRegistry,
}));

// Dynamic import after mocks are registered
const { verifyCommand } = await import('../../src/commands/verify.js');

describe('verify command', () => {
  let ownerKeypair: Ed25519Keypair;
  let ownerAddress: string;
  let walletKey: string;
  let vaultId: string;
  let manifestBuffer: Buffer;

  beforeAll(() => {
    ownerKeypair = Ed25519Keypair.generate();
    ownerAddress = ownerKeypair.getPublicKey().toSuiAddress();
    walletKey = ownerKeypair.getSecretKey();
    vaultId = 'v_vfy001';

    const manifest = createManifest({
      vaultId,
      fileName: 'secret.env',
      fileSize: 42,
      checksum: 'a'.repeat(64),
      ownerAddress,
      allowedWallets: [ownerAddress],
      encryptedKeys: { [ownerAddress]: 'encrypted-key-base64' },
      blobId: 'data-blob-id',
      epochs: 3,
    });
    manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf-8');
  });

  const makeEntry = (): VaultEntry => ({
    vaultId,
    fileName: 'secret.env',
    fileSize: 42,
    blobId: 'data-blob-id',
    manifestBlobId: 'manifest-blob-id',
    ownerAddress,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 90).toISOString(),
    status: 'active',
  });

  beforeEach(() => {
    mockFetchBlob.mockClear();
    mockLoadRegistry.mockClear();
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------
  describe('happy path', () => {
    it('should return "healthy" status with metadata for an existing vault', async () => {
      mockLoadRegistry.mockResolvedValue({ version: 1, walletAddress: ownerAddress, vaults: [makeEntry()] });
      // First fetchBlob → manifest; second → data blob
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer)
        .mockResolvedValueOnce(Buffer.from('fake-encrypted-data'));

      const result = await verifyCommand(vaultId, { walletKey });

      expect(result.status).toBe('healthy');
      expect(result.vaultId).toBe(vaultId);
      expect(result.fileName).toBe('secret.env');
      expect(result.fileSize).toBe(42);
      expect(result.createdAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should call fetchBlob twice (manifest + data)', async () => {
      mockLoadRegistry.mockResolvedValue({ version: 1, walletAddress: ownerAddress, vaults: [makeEntry()] });
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer)
        .mockResolvedValueOnce(Buffer.from('fake-encrypted-data'));

      await verifyCommand(vaultId, { walletKey });

      expect(mockFetchBlob).toHaveBeenCalledTimes(2);
      expect(mockFetchBlob).toHaveBeenNthCalledWith(1, 'manifest-blob-id');
      expect(mockFetchBlob).toHaveBeenNthCalledWith(2, 'data-blob-id');
    });
  });

  // ---------------------------------------------------------------------------
  // Error: blob unavailable on Walrus → "corrupted" with E012
  // ---------------------------------------------------------------------------
  describe('blob unavailable', () => {
    it('should return "corrupted" status when manifest blob is unavailable', async () => {
      mockLoadRegistry.mockResolvedValue({ version: 1, walletAddress: ownerAddress, vaults: [makeEntry()] });
      mockFetchBlob.mockRejectedValue(
        new VaultSuiError(ERROR_CODES.BLOB_UNAVAILABLE, 'Blob not found', 'Check network')
      );

      const result = await verifyCommand(vaultId, { walletKey });

      expect(result.status).toBe('corrupted');
      expect(result.error).toBeDefined();
      expect((result.error as VaultSuiError).code).toBe(ERROR_CODES.BLOB_UNAVAILABLE);
    });

    it('should return "corrupted" status when data blob is unavailable', async () => {
      mockLoadRegistry.mockResolvedValue({ version: 1, walletAddress: ownerAddress, vaults: [makeEntry()] });
      mockFetchBlob
        .mockResolvedValueOnce(manifestBuffer) // manifest OK
        .mockRejectedValueOnce(
          new VaultSuiError(ERROR_CODES.BLOB_UNAVAILABLE, 'Data blob not found', 'Check network')
        );

      const result = await verifyCommand(vaultId, { walletKey });

      expect(result.status).toBe('corrupted');
      expect(result.error).toBeDefined();
      expect((result.error as VaultSuiError).code).toBe(ERROR_CODES.BLOB_UNAVAILABLE);
    });
  });

  // ---------------------------------------------------------------------------
  // Error: vault not found in registry → throws VaultSuiError E007
  // ---------------------------------------------------------------------------
  describe('vault not found', () => {
    it('should throw VaultSuiError E007 when vault is not in the registry', async () => {
      mockLoadRegistry.mockResolvedValue({ version: 1, walletAddress: ownerAddress, vaults: [] });

      await expect(verifyCommand(vaultId, { walletKey })).rejects.toMatchObject({
        code: ERROR_CODES.VAULT_NOT_FOUND,
      });

      expect(mockFetchBlob).not.toHaveBeenCalled();
    });

    it('should throw VaultSuiError E007 for invalid vault ID format', async () => {
      await expect(verifyCommand('invalid-id', { walletKey })).rejects.toMatchObject({
        code: ERROR_CODES.VAULT_NOT_FOUND,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Error: wallet not configured → E002
  // ---------------------------------------------------------------------------
  describe('wallet not configured', () => {
    it('should throw VaultSuiError E002 when wallet key is missing', async () => {
      const saved = process.env['SUI_PRIVATE_KEY'];
      delete process.env['SUI_PRIVATE_KEY'];
      try {
        await expect(verifyCommand(vaultId, {})).rejects.toMatchObject({
          code: ERROR_CODES.WALLET_NOT_CONFIGURED,
        });
      } finally {
        if (saved !== undefined) process.env['SUI_PRIVATE_KEY'] = saved;
      }
    });
  });
});
