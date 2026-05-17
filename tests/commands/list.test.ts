import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ERROR_CODES } from '../../src/utils/errors.js';
import type { VaultEntry } from '../../src/adapters/registry.js';

// --- ESM mocks ---
const mockGetVaultEntries = jest.fn<() => Promise<VaultEntry[]>>();
const mockRecoverVaultsFromChain = jest.fn<() => Promise<VaultEntry[]>>();

jest.unstable_mockModule('../../src/adapters/registry.js', () => ({
  getVaultEntries: mockGetVaultEntries,
}));
jest.unstable_mockModule('../../src/core/recovery.js', () => ({
  recoverVaultsFromChain: mockRecoverVaultsFromChain,
}));

const { listCommand } = await import('../../src/commands/list.js');

// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  vaultId: 'v_aaaaaa',
  fileName: 'secret.env',
  fileSize: 4096,
  blobId: 'blob-1',
  manifestBlobId: 'manifest-1',
  ownerAddress: '0x' + 'a'.repeat(64),
  createdAt: '2026-05-17T10:00:00.000Z',
  expiresAt: '2026-08-17T10:00:00.000Z',
  status: 'active',
  ...overrides,
});

describe('list command', () => {
  let testKeypair: Ed25519Keypair;
  let walletKey: string;

  beforeAll(() => {
    testKeypair = Ed25519Keypair.generate();
    walletKey = testKeypair.getSecretKey();
  });

  beforeEach(() => {
    mockGetVaultEntries.mockClear();
    mockRecoverVaultsFromChain.mockClear();
    // Default: no on-chain vaults (keeps existing empty-registry tests unaffected)
    mockRecoverVaultsFromChain.mockResolvedValue([]);
  });

  // ---------------------------------------------------------------------------
  // Happy path: vaults present
  // ---------------------------------------------------------------------------
  describe('happy path — vaults present', () => {
    it('should return all vault entries from the registry', async () => {
      const entries = [
        makeEntry({ vaultId: 'v_aaaaaa', fileName: '.env' }),
        makeEntry({ vaultId: 'v_bbbbbb', fileName: 'secrets.yml' }),
        makeEntry({ vaultId: 'v_cccccc', fileName: 'config.json', status: 'expired' }),
      ];
      mockGetVaultEntries.mockResolvedValue(entries);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(3);
      expect(result.vaults[0].vaultId).toBe('v_aaaaaa');
      expect(result.vaults[2].status).toBe('expired');
    });

    it('should format fileSize as human-readable bytes in display rows', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry({ fileSize: 4200 })]);

      const result = await listCommand({ walletKey });

      // rows are [id, fileName, formattedSize, created, status]
      const sizeCell = result.rows[0][2];
      expect(sizeCell).toMatch(/KB/);
    });

    it('should include only the date part of createdAt', async () => {
      mockGetVaultEntries.mockResolvedValue([
        makeEntry({ createdAt: '2026-05-17T10:00:00.000Z' }),
      ]);

      const result = await listCommand({ walletKey });

      const dateCell = result.rows[0][3];
      expect(dateCell).toBe('2026-05-17');
    });

    it('should NOT attempt on-chain recovery when local registry already has vaults', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);

      await listCommand({ walletKey });

      expect(mockRecoverVaultsFromChain).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No vaults case
  // ---------------------------------------------------------------------------
  describe('no vaults', () => {
    it('should return an empty vaults array when registry is empty and no on-chain vaults', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      // mockRecoverVaultsFromChain returns [] by default (set in beforeEach)

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Portability: on-chain vault recovery (US5)
  // ---------------------------------------------------------------------------
  describe('on-chain vault recovery', () => {
    it('should recover and display vaults when local registry is empty', async () => {
      const recovered = [
        makeEntry({ vaultId: 'v_recov1', fileName: 'recovered1.env' }),
        makeEntry({ vaultId: 'v_recov2', fileName: 'recovered2.env' }),
      ];
      mockGetVaultEntries.mockResolvedValue([]);
      mockRecoverVaultsFromChain.mockResolvedValue(recovered);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(2);
      expect(result.isEmpty).toBe(false);
      expect(result.vaults[0].vaultId).toBe('v_recov1');
      expect(result.vaults[1].vaultId).toBe('v_recov2');
    });

    it('should display empty list when wallet has no on-chain vaults either', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockRecoverVaultsFromChain.mockResolvedValue([]);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
    });

    it('should call recoverVaultsFromChain when registry is empty', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockRecoverVaultsFromChain.mockResolvedValue([makeEntry()]);

      await listCommand({ walletKey });

      expect(mockRecoverVaultsFromChain).toHaveBeenCalledTimes(1);
    });

    it('should display empty list gracefully if on-chain recovery throws', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockRecoverVaultsFromChain.mockRejectedValue(new Error('Network error'));

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error: wallet not configured
  // ---------------------------------------------------------------------------
  describe('error cases', () => {
    it('should throw VaultSuiError E002 when no wallet key configured', async () => {
      const saved = process.env['SUI_PRIVATE_KEY'];
      delete process.env['SUI_PRIVATE_KEY'];
      try {
        await expect(listCommand({})).rejects.toMatchObject({
          code: ERROR_CODES.WALLET_NOT_CONFIGURED,
        });
      } finally {
        if (saved !== undefined) process.env['SUI_PRIVATE_KEY'] = saved;
      }
    });
  });
});
