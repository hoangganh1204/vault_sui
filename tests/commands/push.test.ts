import { jest, describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { VaultSuiError, ERROR_CODES } from '../../src/utils/errors.js';

// ESM-compatible mocking — must use jest.unstable_mockModule before dynamic imports
const mockStoreBlob = jest.fn().mockResolvedValue('mock-blob-id');
const mockAddVaultEntry = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../src/adapters/walrus.js', () => ({
  storeBlob: mockStoreBlob,
}));
jest.unstable_mockModule('../../src/adapters/registry.js', () => ({
  addVaultEntry: mockAddVaultEntry,
}));

// Dynamic import after mocks are registered
const { pushCommand } = await import('../../src/commands/push.js');

describe('push command', () => {
  let testDir: string;
  let testFile: string;
  let testKeypair: Ed25519Keypair;
  let walletKey: string;

  beforeAll(() => {
    testKeypair = Ed25519Keypair.generate();
    walletKey = testKeypair.getSecretKey();
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `vault-push-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testFile = join(testDir, '.env');
    await writeFile(testFile, 'SECRET=hello\nAPI_KEY=world\n', 'utf-8');

    mockStoreBlob.mockClear();
    mockAddVaultEntry.mockClear();
    mockStoreBlob.mockResolvedValue('mock-blob-id');
    mockAddVaultEntry.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('happy path', () => {
    it('should return a valid vault ID', async () => {
      const result = await pushCommand(testFile, { walletKey });
      expect(result.vaultId).toMatch(/^v_[A-Za-z0-9_-]{6}$/);
    });

    it('should call storeBlob twice (data + manifest)', async () => {
      await pushCommand(testFile, { walletKey });
      expect(mockStoreBlob).toHaveBeenCalledTimes(2);
    });

    it('should call addVaultEntry once with correct vaultId', async () => {
      const result = await pushCommand(testFile, { walletKey });
      expect(mockAddVaultEntry).toHaveBeenCalledTimes(1);
      const firstCall = mockAddVaultEntry.mock.calls[0] as unknown[];
      expect(firstCall).toBeDefined();
      const entry = firstCall[0] as { vaultId: string; status: string };
      expect(entry.vaultId).toBe(result.vaultId);
      expect(entry.status).toBe('active');
    });

    it('should include owner in allowedWallets', async () => {
      const result = await pushCommand(testFile, { walletKey });
      expect(result.allowedWallets).toContain(result.ownerAddress);
    });

    it('should include recipient in allowedWallets when --allow is given', async () => {
      const recipientKp = Ed25519Keypair.generate();
      const recipientAddress = recipientKp.getPublicKey().toSuiAddress();
      const result = await pushCommand(testFile, { walletKey, allow: [recipientAddress] });
      expect(result.allowedWallets).toContain(recipientAddress);
    });
  });

  describe('error cases', () => {
    it('should throw VaultSuiError E002 when no wallet key configured', async () => {
      const saved = process.env['SUI_PRIVATE_KEY'];
      delete process.env['SUI_PRIVATE_KEY'];
      try {
        await expect(pushCommand(testFile, {})).rejects.toMatchObject({
          code: ERROR_CODES.WALLET_NOT_CONFIGURED,
        });
      } finally {
        if (saved !== undefined) process.env['SUI_PRIVATE_KEY'] = saved;
      }
    });

    it('should throw VaultSuiError E003 for an invalid recipient address', async () => {
      await expect(
        pushCommand(testFile, { walletKey, allow: ['not-a-valid-address'] })
      ).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_ADDRESS,
      });
    });

    it('should throw VaultSuiError when file does not exist', async () => {
      await expect(
        pushCommand(join(testDir, 'nonexistent.env'), { walletKey })
      ).rejects.toThrow(VaultSuiError);
    });
  });
});
