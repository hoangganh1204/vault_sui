import { WalrusClient } from '@mysten/walrus';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import type { Signer } from '@mysten/sui/cryptography';
import { withRetry } from '../utils/retry.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

const NETWORK_RPC_URLS: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

function getNetwork(): 'testnet' | 'mainnet' {
  const net = process.env['VAULTSUI_NETWORK'] ?? 'testnet';
  return net === 'mainnet' ? 'mainnet' : 'testnet';
}

function createClient(): WalrusClient {
  const network = getNetwork();
  const url = NETWORK_RPC_URLS[network] ?? NETWORK_RPC_URLS['testnet']!;
  const suiClient = new SuiJsonRpcClient({ url, network });
  return new WalrusClient({ network, suiClient });
}

export async function storeBlob(
  data: Buffer,
  signer: Signer,
  epochs = 3
): Promise<string> {
  const client = createClient();
  const blob = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  try {
    const result = await withRetry(() =>
      client.writeBlob({ blob, deletable: false, epochs, signer })
    );
    return result.blobId;
  } catch (err) {
    throw new VaultSuiError(
      ERROR_CODES.UPLOAD_FAILED,
      `Failed to upload blob: ${String(err)}`,
      'Check your network connection and Sui wallet balance'
    );
  }
}

export async function fetchBlob(blobId: string): Promise<Buffer> {
  const client = createClient();
  try {
    const data = await withRetry(() => client.readBlob({ blobId }));
    return Buffer.from(data);
  } catch (err) {
    throw new VaultSuiError(
      ERROR_CODES.BLOB_UNAVAILABLE,
      `Failed to fetch blob "${blobId}": ${String(err)}`,
      'The blob may have expired or the network may be unavailable'
    );
  }
}
