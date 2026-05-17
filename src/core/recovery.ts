import { listOwnerBlobIds, fetchBlob } from '../adapters/walrus.js';
import { addVaultEntry } from '../adapters/registry.js';
import { parseManifest } from '../core/manifest.js';
import type { VaultEntry } from '../adapters/registry.js';

export async function recoverVaultsFromChain(walletAddress: string): Promise<VaultEntry[]> {
  const blobIds = await listOwnerBlobIds(walletAddress);
  const recovered: VaultEntry[] = [];

  for (const blobId of blobIds) {
    try {
      const data = await fetchBlob(blobId);
      const manifest = parseManifest(data.toString('utf-8'));

      // Only recover vaults where this wallet is the owner
      if (manifest.ownerAddress !== walletAddress) continue;

      const expiresAt = new Date(
        new Date(manifest.createdAt).getTime() + 86400000 * 30 * manifest.epochs
      ).toISOString();

      const entry: VaultEntry = {
        vaultId: manifest.vaultId,
        fileName: manifest.fileName,
        fileSize: manifest.fileSize,
        blobId: manifest.blobId,
        manifestBlobId: blobId,
        ownerAddress: manifest.ownerAddress,
        createdAt: manifest.createdAt,
        expiresAt,
        status: 'active',
      };

      recovered.push(entry);
      await addVaultEntry(entry, walletAddress);
    } catch {
      // Skip blobs that can't be parsed as vault manifests (e.g. data blobs)
    }
  }

  return recovered;
}
