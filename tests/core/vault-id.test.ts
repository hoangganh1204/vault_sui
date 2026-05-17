import { generateVaultId, validateVaultId } from '../../src/core/vault-id.js';

describe('vault-id', () => {
  describe('generateVaultId', () => {
    it('should generate an id matching /^v_[A-Za-z0-9_-]{6}$/', () => {
      const id = generateVaultId();
      expect(id).toMatch(/^v_[A-Za-z0-9_-]{6}$/);
    });

    it('should generate unique ids', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateVaultId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('validateVaultId', () => {
    it('should return true for valid vault ids', () => {
      expect(validateVaultId('v_abc123')).toBe(true);
      expect(validateVaultId('v_ABC-_x')).toBe(true);
      expect(validateVaultId('v_000000')).toBe(true);
    });

    it('should return false for ids without v_ prefix', () => {
      expect(validateVaultId('abc123')).toBe(false);
      expect(validateVaultId('x_abc123')).toBe(false);
    });

    it('should return false for ids with wrong payload length', () => {
      expect(validateVaultId('v_abc')).toBe(false);
      expect(validateVaultId('v_abcdefg')).toBe(false);
      expect(validateVaultId('v_')).toBe(false);
    });
  });
});
