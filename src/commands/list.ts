import { loadKeypair } from '../adapters/sui.js';
import { getVaultEntries, saveRegistry } from '../adapters/registry.js';
import { listOwnedManifests } from '../adapters/walrus.js';
import type { VaultEntry } from '../adapters/registry.js';
import { getAddress } from '../core/wallet.js';
import { formatBytes } from '../utils/format.js';
import * as logger from '../utils/logger.js';

export interface ListOptions {
  walletKey?: string;
  json?: boolean;
}

export interface ListResult {
  vaults: VaultEntry[];
  rows: string[][];
  isEmpty: boolean;
}

const TABLE_HEAD = ['ID', 'File', 'Size', 'Created', 'Status'];

function formatStatus(status: string): string {
  if (status === 'active') return 'active';
  if (status === 'expired') return 'expired';
  return 'unknown';
}

function buildRows(vaults: VaultEntry[]): string[][] {
  return vaults.map((v) => [
    v.vaultId,
    v.fileName,
    formatBytes(v.fileSize),
    v.createdAt.split('T')[0] ?? v.createdAt,
    formatStatus(v.status),
  ]);
}

export async function listCommand(options: ListOptions): Promise<ListResult> {
  // Validate wallet (throws E002 if not configured)
  const keypair = loadKeypair(options.walletKey);
  const walletAddress = getAddress(keypair);

  let vaults = await getVaultEntries(walletAddress);

  // On-chain recovery when local registry is empty
  if (vaults.length === 0) {
    const spin = logger.spinner('Scanning chain for vaults...');
    try {
      const recovered = await listOwnedManifests(walletAddress);
      if (recovered.length > 0) {
        vaults = recovered.map(({ manifest, manifestBlobId }) => ({
          vaultId: manifest.vaultId,
          fileName: manifest.fileName,
          fileSize: manifest.fileSize,
          blobId: manifest.blobId,
          manifestBlobId,
          ownerAddress: manifest.ownerAddress,
          createdAt: manifest.createdAt,
          expiresAt: new Date(
            new Date(manifest.createdAt).getTime() + 86400000 * 30 * manifest.epochs
          ).toISOString(),
          status: 'active' as const,
        }));
        await saveRegistry({ version: 1, walletAddress, vaults });
        spin.succeed(`Recovered ${vaults.length} vault(s) from chain`);
      } else {
        spin.stop();
      }
    } catch {
      spin.stop();
    }
  }

  const rows = buildRows(vaults);
  const isEmpty = vaults.length === 0;

  if (options.json) {
    logger.info(JSON.stringify(vaults, null, 2));
    return { vaults, rows, isEmpty };
  }

  if (isEmpty) {
    logger.info("No vaults found. Use 'vault-sui push <file>' to create your first vault.");
    return { vaults, rows, isEmpty };
  }

  logger.info(`Your Vaults (${vaults.length}):\n`);
  logger.table(TABLE_HEAD, rows);

  return { vaults, rows, isEmpty };
}
