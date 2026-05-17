import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadRegistry,
  saveRegistry,
  addVaultEntry,
  getVaultEntries,
  type VaultEntry,
} from '../../src/adapters/registry.js';

describe('registry adapter', () => {
  let testDir: string;
  let registryPath: string;
  const walletAddress = '0x' + 'a'.repeat(64);

  const makeEntry = (vaultId: string): VaultEntry => ({
    vaultId,
    fileName: 'secret.env',
    fileSize: 1024,
    blobId: `blob-${vaultId}`,
    manifestBlobId: `manifest-${vaultId}`,
    ownerAddress: walletAddress,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 90).toISOString(),
    status: 'active',
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `vaultsui-registry-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    registryPath = join(testDir, 'vaults.json');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadRegistry', () => {
    it('should return an empty registry when no file exists', async () => {
      const registry = await loadRegistry(walletAddress, registryPath);
      expect(registry.version).toBe(1);
      expect(registry.walletAddress).toBe(walletAddress);
      expect(registry.vaults).toEqual([]);
    });

    it('should load an existing registry from disk', async () => {
      const initial = { version: 1, walletAddress, vaults: [makeEntry('v_aaaaaa')] };
      await saveRegistry(initial, registryPath);
      const loaded = await loadRegistry(walletAddress, registryPath);
      expect(loaded.vaults).toHaveLength(1);
      expect(loaded.vaults[0]!.vaultId).toBe('v_aaaaaa');
    });
  });

  describe('saveRegistry', () => {
    it('should persist registry to disk', async () => {
      const registry = { version: 1, walletAddress, vaults: [] };
      await saveRegistry(registry, registryPath);
      const loaded = await loadRegistry(walletAddress, registryPath);
      expect(loaded.walletAddress).toBe(walletAddress);
    });
  });

  describe('addVaultEntry', () => {
    it('should add a new entry to the registry', async () => {
      const entry = makeEntry('v_bbbbb1');
      await addVaultEntry(entry, walletAddress, registryPath);
      const entries = await getVaultEntries(walletAddress, registryPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.vaultId).toBe('v_bbbbb1');
    });

    it('should update an existing entry with the same vaultId', async () => {
      const entry = makeEntry('v_cccccc');
      await addVaultEntry(entry, walletAddress, registryPath);
      const updated = { ...entry, status: 'expired' as const };
      await addVaultEntry(updated, walletAddress, registryPath);
      const entries = await getVaultEntries(walletAddress, registryPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.status).toBe('expired');
    });
  });

  describe('getVaultEntries', () => {
    it('should return all vault entries', async () => {
      await addVaultEntry(makeEntry('v_dddddd'), walletAddress, registryPath);
      await addVaultEntry(makeEntry('v_eeeeee'), walletAddress, registryPath);
      const entries = await getVaultEntries(walletAddress, registryPath);
      expect(entries).toHaveLength(2);
    });

    it('should return empty array when registry has no vaults', async () => {
      const entries = await getVaultEntries(walletAddress, registryPath);
      expect(entries).toEqual([]);
    });
  });
});
