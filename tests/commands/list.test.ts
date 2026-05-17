import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { VaultSuiError, ERROR_CODES } from '../../src/utils/errors.js';
import { createManifest } from '../../src/core/manifest.js';
import type { VaultEntry } from '../../src/adapters/registry.js';
import type { RecoveredVault } from '../../src/adapters/walrus.js';

// --- ESM mocks ---
const mockGetVaultEntries = jest.fn<() => Promise<VaultEntry[]>>();
const mockSaveRegistry = jest.fn<() => Promise<void>>();
const mockListOwnedManifests = jest.fn<() => Promise<RecoveredVault[]>>();

jest.unstable_mockModule('../../src/adapters/registry.js', () => ({
  getVaultEntries: mockGetVaultEntries,
  saveRegistry: mockSaveRegistry,
}));

jest.unstable_mockModule('../../src/adapters/walrus.js', () => ({
  listOwnedManifests: mockListOwnedManifests,
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
    mockSaveRegistry.mockClear();
    mockListOwnedManifests.mockClear();
    // Default: no on-chain vaults (keeps existing empty-registry tests unaffected)
    mockListOwnedManifests.mockResolvedValue([]);
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
      expect(result.vaults[0]!.vaultId).toBe('v_aaaaaa');
      expect(result.vaults[2]!.status).toBe('expired');
    });

    it('should format fileSize as human-readable bytes in display rows', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry({ fileSize: 4200 })]);

      const result = await listCommand({ walletKey });

      // rows are [id, fileName, formattedSize, created, status]
      const sizeCell = result.rows[0]![2];
      expect(sizeCell).toMatch(/KB/);
    });

    it('should include only the date part of createdAt', async () => {
      mockGetVaultEntries.mockResolvedValue([
        makeEntry({ createdAt: '2026-05-17T10:00:00.000Z' }),
      ]);

      const result = await listCommand({ walletKey });

      const dateCell = result.rows[0]![3];
      expect(dateCell).toBe('2026-05-17');
    });
  });

  // ---------------------------------------------------------------------------
  // No vaults case
  // ---------------------------------------------------------------------------
  describe('no vaults', () => {
    it('should return an empty vaults array when registry is empty and no on-chain vaults', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockListOwnedManifests.mockResolvedValue([]);

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

  // ---------------------------------------------------------------------------
  // T031: On-chain recovery (US5) — portability tests
  // ---------------------------------------------------------------------------
  describe('on-chain recovery (US5)', () => {
    it('should recover and display all vaults when local registry is empty but on-chain vaults exist', async () => {
      const ownerAddress = testKeypair.getPublicKey().toSuiAddress();
      const manifest = createManifest({
        vaultId: 'v_rec001',
        fileName: 'recovered.env',
        fileSize: 1024,
        checksum: 'a'.repeat(64),
        ownerAddress,
        allowedWallets: [ownerAddress],
        encryptedKeys: { [ownerAddress]: 'wrapped-key-base64' },
        blobId: 'data-blob-id',
        epochs: 3,
      });

      mockGetVaultEntries.mockResolvedValue([]);
      mockListOwnedManifests.mockResolvedValue([
        { manifest, manifestBlobId: 'manifest-blob-id' },
      ]);
      mockSaveRegistry.mockResolvedValue(undefined);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(1);
      expect(result.vaults[0]!.vaultId).toBe('v_rec001');
      expect(result.vaults[0]!.fileName).toBe('recovered.env');
      expect(result.vaults[0]!.fileSize).toBe(1024);
      expect(result.isEmpty).toBe(false);
      expect(mockListOwnedManifests).toHaveBeenCalledTimes(1);
      expect(mockSaveRegistry).toHaveBeenCalledTimes(1);
    });

    it('should recover multiple vaults from chain when registry is empty', async () => {
      const ownerAddress = testKeypair.getPublicKey().toSuiAddress();
      const makeManifest = (vaultId: string, fileName: string) =>
        createManifest({
          vaultId,
          fileName,
          fileSize: 512,
          checksum: 'b'.repeat(64),
          ownerAddress,
          allowedWallets: [ownerAddress],
          encryptedKeys: { [ownerAddress]: 'wrapped-key-base64' },
          blobId: `data-${vaultId}`,
          epochs: 2,
        });

      mockGetVaultEntries.mockResolvedValue([]);
      mockListOwnedManifests.mockResolvedValue([
        { manifest: makeManifest('v_rec001', 'file1.env'), manifestBlobId: 'mb-1' },
        { manifest: makeManifest('v_rec002', 'file2.env'), manifestBlobId: 'mb-2' },
      ]);
      mockSaveRegistry.mockResolvedValue(undefined);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(2);
      expect(result.vaults[0]!.vaultId).toBe('v_rec001');
      expect(result.vaults[1]!.vaultId).toBe('v_rec002');
      expect(result.isEmpty).toBe(false);
      expect(mockSaveRegistry).toHaveBeenCalledTimes(1);
    });

    it('should display empty list when local registry is empty and wallet has no on-chain vaults', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockListOwnedManifests.mockResolvedValue([]);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
      expect(mockListOwnedManifests).toHaveBeenCalledTimes(1);
      expect(mockSaveRegistry).not.toHaveBeenCalled();
    });

    it('should NOT attempt on-chain recovery when local registry already has vaults', async () => {
      mockGetVaultEntries.mockResolvedValue([makeEntry()]);

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(1);
      expect(mockListOwnedManifests).not.toHaveBeenCalled();
    });

    it('should display empty list gracefully if on-chain recovery throws', async () => {
      mockGetVaultEntries.mockResolvedValue([]);
      mockListOwnedManifests.mockRejectedValue(new Error('Network error'));

      const result = await listCommand({ walletKey });

      expect(result.vaults).toHaveLength(0);
      expect(result.isEmpty).toBe(true);
    });
  });
});
