import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createKeypair } from '../core/wallet.js';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

export function loadKeypair(walletKey?: string): Ed25519Keypair {
  const key = walletKey ?? process.env['SUI_PRIVATE_KEY'];
  if (!key) {
    throw new VaultSuiError(
      ERROR_CODES.WALLET_NOT_CONFIGURED,
      'No wallet key provided',
      'Set the SUI_PRIVATE_KEY environment variable or pass --wallet-key'
    );
  }
  return createKeypair(key);
}
