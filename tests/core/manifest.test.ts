import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  createManifest,
  parseManifest,
  validateManifest,
  type Manifest,
} from '../../src/core/manifest.js';
import { VaultSuiError } from '../../src/utils/errors.js';

describe('manifest', () => {
  let ownerAddress: string;
  let validParams: Parameters<typeof createManifest>[0];
  let validManifest: Manifest;

  beforeAll(() => {
    const kp = Ed25519Keypair.generate();
    ownerAddress = kp.getPublicKey().toSuiAddress();
    validParams = {
      vaultId: 'v_abc123',
      fileName: 'secret.env',
      fileSize: 1024,
      checksum: 'a'.repeat(64),
      ownerAddress,
      allowedWallets: [ownerAddress],
      encryptedKeys: { [ownerAddress]: 'base64encodedkey==' },
      blobId: 'walrus-blob-id-123',
      epochs: 3,
    };
    validManifest = createManifest(validParams);
  });

  describe('createManifest', () => {
    it('should create a manifest with version 1 and correct fields', () => {
      expect(validManifest.version).toBe(1);
      expect(validManifest.vaultId).toBe('v_abc123');
      expect(validManifest.compressionAlgo).toBe('deflate');
      expect(validManifest.encryptionAlgo).toBe('aes-256-gcm');
      expect(validManifest.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('parseManifest', () => {
    it('should parse a valid JSON manifest', () => {
      const json = JSON.stringify(validManifest);
      const parsed = parseManifest(json);
      expect(parsed.vaultId).toBe(validManifest.vaultId);
    });

    it('should throw VaultSuiError for invalid JSON', () => {
      expect(() => parseManifest('{invalid json')).toThrow(VaultSuiError);
    });

    it('should throw VaultSuiError for non-object JSON', () => {
      expect(() => parseManifest('"just a string"')).toThrow(VaultSuiError);
    });
  });

  describe('validateManifest', () => {
    it('should not throw for a valid manifest', () => {
      expect(() => validateManifest(validManifest)).not.toThrow();
    });

    it('should throw when vaultId is invalid', () => {
      const bad = { ...validManifest, vaultId: 'bad_id' };
      expect(() => validateManifest(bad)).toThrow(VaultSuiError);
    });

    it('should throw when ownerAddress is not in allowedWallets', () => {
      const otherKp = Ed25519Keypair.generate();
      const otherAddr = otherKp.getPublicKey().toSuiAddress();
      const bad = { ...validManifest, allowedWallets: [otherAddr] };
      expect(() => validateManifest(bad)).toThrow(VaultSuiError);
    });
  });
});
