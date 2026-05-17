import { WalrusClient, blobIdFromInt } from '@mysten/walrus';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import type { Signer } from '@mysten/sui/cryptography';
import { withRetry } from '../utils/retry.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

const FALLBACK_TESTNET_URL = 'https://fullnode.testnet.sui.io:443';

const NETWORK_RPC_URLS: Record<string, string> = {
  testnet: FALLBACK_TESTNET_URL,
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

function getNetwork(): 'testnet' | 'mainnet' {
  const net = process.env['VAULTSUI_NETWORK'] ?? 'testnet';
  return net === 'mainnet' ? 'mainnet' : 'testnet';
}

function createClient(): WalrusClient {
  const network = getNetwork();
  const url = NETWORK_RPC_URLS[network] ?? FALLBACK_TESTNET_URL;
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

function extractBlobId(obj: { data?: { content?: unknown } }): string | null {
  const content = obj.data?.content;
  if (!content || typeof content !== 'object') return null;
  const c = content as { dataType?: string; fields?: unknown };
  if (c.dataType !== 'moveObject' || !c.fields || typeof c.fields !== 'object') return null;
  const fields = c.fields as Record<string, unknown>;
  const blobIdInt = fields['blob_id'];
  if (typeof blobIdInt !== 'string' && typeof blobIdInt !== 'number' && typeof blobIdInt !== 'bigint') {
    return null;
  }
  try {
    return blobIdFromInt(BigInt(blobIdInt));
  } catch {
    return null;
  }
}

export async function listOwnerBlobIds(walletAddress: string): Promise<string[]> {
  const network = getNetwork();
  const url = NETWORK_RPC_URLS[network] ?? FALLBACK_TESTNET_URL;
  const suiClient = new SuiJsonRpcClient({ url, network });
  const walrusClient = new WalrusClient({ network, suiClient });

  const blobType = await walrusClient.getBlobType();
  const blobIds: string[] = [];
  let cursor: string | null = null;

  do {
    const page = await suiClient.getOwnedObjects({
      owner: walletAddress,
      filter: { StructType: blobType },
      options: { showContent: true },
      ...(cursor ? { cursor } : {}),
      limit: 50,
    });

    for (const obj of page.data) {
      const blobId = extractBlobId(obj);
      if (blobId !== null) blobIds.push(blobId);
    }

    cursor = page.nextCursor ?? null;
  } while (cursor);

  return blobIds;
}
