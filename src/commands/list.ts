import { loadKeypair } from '../adapters/sui.js';
import { getVaultEntries } from '../adapters/registry.js';
import type { VaultEntry } from '../adapters/registry.js';
import { recoverVaultsFromChain } from '../core/recovery.js';
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

  // When local registry is empty, attempt to recover vaults from on-chain data
  if (vaults.length === 0) {
    try {
      vaults = await recoverVaultsFromChain(walletAddress);
    } catch {
      // Recovery failed — show empty list gracefully
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
