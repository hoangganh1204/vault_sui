import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

const SUI_ADDRESS_REGEX = /^0x[0-9a-fA-F]{64}$/;

export function validateSuiAddress(address: string): boolean {
  return SUI_ADDRESS_REGEX.test(address);
}

export function createKeypair(privateKey: string): Ed25519Keypair {
  if (privateKey.startsWith('suiprivkey')) {
    return Ed25519Keypair.fromSecretKey(privateKey);
  }
  let secretKey: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    secretKey = Buffer.from(privateKey, 'hex');
  } else {
    secretKey = Buffer.from(privateKey, 'base64');
  }
  try {
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch (err) {
    throw new VaultSuiError(
      ERROR_CODES.WALLET_NOT_CONFIGURED,
      `Invalid private key: ${String(err)}`,
      'Provide a valid Ed25519 private key (hex, base64, or suiprivkey bech32)'
    );
  }
}

export function getAddress(keypair: Ed25519Keypair): string {
  return keypair.getPublicKey().toSuiAddress();
}

export async function signMessage(keypair: Ed25519Keypair, message: string): Promise<string> {
  const messageBytes = Buffer.from(message, 'utf-8');
  const { signature } = await keypair.signPersonalMessage(messageBytes);
  return signature;
}

export async function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  const messageBytes = Buffer.from(message, 'utf-8');
  try {
    const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);
    return publicKey.toSuiAddress() === expectedAddress;
  } catch {
    return false;
  }
}
