import { writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compressFile, decompressBuffer } from '../../src/core/compress.js';
import { VaultSuiError } from '../../src/utils/errors.js';

describe('compress / decompress', () => {
  let testDir: string;
  let testFile: string;
  const testContent = 'Hello, VaultSui! This is test content for compression.';

  beforeEach(async () => {
    testDir = join(tmpdir(), `vaultsui-compress-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testFile = join(testDir, 'test.txt');
    await writeFile(testFile, testContent, 'utf-8');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('compressFile', () => {
    it('should compress a file into a non-empty Buffer', async () => {
      const buffer = await compressFile(testFile);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should throw VaultSuiError for a non-existent file', async () => {
      await expect(
        compressFile(join(testDir, 'nonexistent.txt'))
      ).rejects.toThrow(VaultSuiError);
    });
  });

  describe('decompressBuffer', () => {
    it('should decompress and restore the original file content', async () => {
      const outputDir = join(testDir, 'output');
      await mkdir(outputDir, { recursive: true });

      const buffer = await compressFile(testFile);
      await decompressBuffer(buffer, outputDir);

      const restored = await readFile(join(outputDir, 'test.txt'), 'utf-8');
      expect(restored).toBe(testContent);
    });

    it('should throw when given an invalid zip buffer', async () => {
      const outputDir = join(testDir, 'output2');
      await mkdir(outputDir, { recursive: true });
      const garbage = Buffer.from('this is not a zip file');
      await expect(decompressBuffer(garbage, outputDir)).rejects.toThrow();
    });
  });
});
