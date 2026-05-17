import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface VaultEntry {
  vaultId: string;
  fileName: string;
  fileSize: number;
  blobId: string;
  manifestBlobId: string;
  ownerAddress: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'unknown';
}

export interface VaultRegistry {
  version: number;
  walletAddress: string;
  vaults: VaultEntry[];
}

const DEFAULT_REGISTRY_DIR = join(homedir(), '.vaultsui');
const DEFAULT_REGISTRY_PATH = join(DEFAULT_REGISTRY_DIR, 'vaults.json');

function getRegistryPath(registryPath?: string): string {
  return registryPath ?? DEFAULT_REGISTRY_PATH;
}

export async function loadRegistry(
  walletAddress: string,
  registryPath?: string
): Promise<VaultRegistry> {
  const filePath = getRegistryPath(registryPath);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as VaultRegistry;
  } catch {
    return { version: 1, walletAddress, vaults: [] };
  }
}

export async function saveRegistry(
  registry: VaultRegistry,
  registryPath?: string
): Promise<void> {
  const filePath = getRegistryPath(registryPath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(registry, null, 2), 'utf-8');
}

export async function addVaultEntry(
  entry: VaultEntry,
  walletAddress: string,
  registryPath?: string
): Promise<void> {
  const registry = await loadRegistry(walletAddress, registryPath);
  const existingIndex = registry.vaults.findIndex((v) => v.vaultId === entry.vaultId);
  if (existingIndex >= 0) {
    registry.vaults[existingIndex] = entry;
  } else {
    registry.vaults.push(entry);
  }
  await saveRegistry(registry, registryPath);
}

export async function getVaultEntries(
  walletAddress: string,
  registryPath?: string
): Promise<VaultEntry[]> {
  const registry = await loadRegistry(walletAddress, registryPath);
  return registry.vaults;
}
