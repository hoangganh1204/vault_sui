import { computeChecksum, verifyChecksum } from '../../src/core/checksum.js';

describe('checksum', () => {
  describe('computeChecksum', () => {
    it('should return a 64-char hex string', () => {
      const checksum = computeChecksum(Buffer.from('hello'));
      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic for the same input', () => {
      const data = Buffer.from('test data');
      expect(computeChecksum(data)).toBe(computeChecksum(data));
    });

    it('should produce different checksums for different inputs', () => {
      const a = computeChecksum(Buffer.from('hello'));
      const b = computeChecksum(Buffer.from('world'));
      expect(a).not.toBe(b);
    });
  });

  describe('verifyChecksum', () => {
    it('should return true for matching checksum', () => {
      const data = Buffer.from('test');
      const checksum = computeChecksum(data);
      expect(verifyChecksum(data, checksum)).toBe(true);
    });

    it('should return false for a wrong checksum', () => {
      const data = Buffer.from('test');
      expect(verifyChecksum(data, 'a'.repeat(64))).toBe(false);
    });

    it('should return false for tampered data', () => {
      const data = Buffer.from('test');
      const checksum = computeChecksum(data);
      const tampered = Buffer.from('test!');
      expect(verifyChecksum(tampered, checksum)).toBe(false);
    });
  });
});
