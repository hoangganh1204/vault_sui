import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  validateSuiAddress,
  createKeypair,
  getAddress,
  signMessage,
  verifySignature,
} from '../../src/core/wallet.js';

describe('wallet', () => {
  let testKeypair: Ed25519Keypair;
  let testAddress: string;

  beforeAll(() => {
    testKeypair = Ed25519Keypair.generate();
    testAddress = testKeypair.getPublicKey().toSuiAddress();
  });

  describe('validateSuiAddress', () => {
    it('should return true for a valid Sui address', () => {
      expect(validateSuiAddress(testAddress)).toBe(true);
    });

    it('should return false for an address without 0x prefix', () => {
      const withoutPrefix = testAddress.slice(2);
      expect(validateSuiAddress(withoutPrefix)).toBe(false);
    });

    it('should return false for an address with wrong length', () => {
      expect(validateSuiAddress('0x1234')).toBe(false);
      expect(validateSuiAddress('0x' + 'a'.repeat(63))).toBe(false);
    });
  });

  describe('createKeypair', () => {
    it('should recreate a keypair from its bech32 secret key', () => {
      const secretKey = testKeypair.getSecretKey();
      const recreated = createKeypair(secretKey);
      expect(getAddress(recreated)).toBe(testAddress);
    });
  });

  describe('getAddress', () => {
    it('should return the correct Sui address for a keypair', () => {
      const addr = getAddress(testKeypair);
      expect(addr).toBe(testAddress);
      expect(validateSuiAddress(addr)).toBe(true);
    });
  });

  describe('signMessage / verifySignature', () => {
    it('should sign a message and verify it successfully', async () => {
      const msg = 'vaultsui:key:v_test01';
      const sig = await signMessage(testKeypair, msg);
      const valid = await verifySignature(msg, sig, testAddress);
      expect(valid).toBe(true);
    });

    it('should return false when verifying with the wrong address', async () => {
      const msg = 'vaultsui:key:v_test01';
      const sig = await signMessage(testKeypair, msg);
      const otherKeypair = Ed25519Keypair.generate();
      const otherAddress = getAddress(otherKeypair);
      const valid = await verifySignature(msg, sig, otherAddress);
      expect(valid).toBe(false);
    });

    it('should return false for a tampered signature', async () => {
      const msg = 'vaultsui:key:v_test01';
      const valid = await verifySignature(msg, 'invalidsignature', testAddress);
      expect(valid).toBe(false);
    });
  });
});
