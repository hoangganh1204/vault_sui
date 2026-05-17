import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '../../src/core/encrypt.js';
import { VaultSuiError } from '../../src/utils/errors.js';

describe('encrypt / decrypt', () => {
  const key = randomBytes(32);
  const vaultId = 'v_test12';

  it('should round-trip encrypt/decrypt successfully', () => {
    const plaintext = Buffer.from('Hello, VaultSui!');
    const encrypted = encrypt(plaintext, key, vaultId);
    const decrypted = decrypt(encrypted, key, vaultId);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertext each call due to random IV', () => {
    const plaintext = Buffer.from('same data');
    const enc1 = encrypt(plaintext, key, vaultId);
    const enc2 = encrypt(plaintext, key, vaultId);
    expect(enc1.equals(enc2)).toBe(false);
  });

  it('should fail decryption with a wrong key', () => {
    const plaintext = Buffer.from('secret');
    const encrypted = encrypt(plaintext, key, vaultId);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(encrypted, wrongKey, vaultId)).toThrow(VaultSuiError);
  });

  it('should fail decryption with wrong vaultId (AAD mismatch)', () => {
    const plaintext = Buffer.from('secret');
    const encrypted = encrypt(plaintext, key, vaultId);
    expect(() => decrypt(encrypted, key, 'v_wrong1')).toThrow(VaultSuiError);
  });

  it('should throw VaultSuiError on data shorter than header', () => {
    const shortData = Buffer.from('tooshort');
    expect(() => decrypt(shortData, key, vaultId)).toThrow(VaultSuiError);
  });
});
