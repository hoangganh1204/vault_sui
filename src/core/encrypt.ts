import { createCipheriv, createDecipheriv, randomBytes, createSecretKey } from 'node:crypto';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

const IV_SIZE = 12;
const TAG_SIZE = 16;
const HEADER_SIZE = IV_SIZE + TAG_SIZE;

export function encrypt(plaintext: Buffer, key: Buffer, vaultId: string): Buffer {
  const iv = randomBytes(IV_SIZE);
  const keyObj = createSecretKey(key);
  const cipher = createCipheriv('aes-256-gcm', keyObj, iv);
  cipher.setAAD(Buffer.from(vaultId, 'utf-8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decrypt(data: Buffer, key: Buffer, vaultId: string): Buffer {
  if (data.length < HEADER_SIZE) {
    throw new VaultSuiError(
      ERROR_CODES.DECRYPTION_FAILED,
      'Encrypted data is too short',
      'Ensure the data is a valid VaultSui encrypted blob'
    );
  }
  const iv = data.subarray(0, IV_SIZE);
  const tag = data.subarray(IV_SIZE, HEADER_SIZE);
  const ciphertext = data.subarray(HEADER_SIZE);
  const keyObj = createSecretKey(key);
  const decipher = createDecipheriv('aes-256-gcm', keyObj, iv);
  decipher.setAuthTag(tag);
  decipher.setAAD(Buffer.from(vaultId, 'utf-8'));
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new VaultSuiError(
      ERROR_CODES.DECRYPTION_FAILED,
      'Decryption failed: invalid key or corrupted data',
      'Ensure you are authorized to restore this vault and the data is not corrupted'
    );
  }
}
