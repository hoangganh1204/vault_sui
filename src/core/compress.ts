import archiver from 'archiver';
import extractZip from 'extract-zip';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { writeFile, unlink, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { VaultSuiError, ERROR_CODES } from '../utils/errors.js';

export async function compressFile(filePath: string): Promise<Buffer> {
  try {
    await access(filePath);
  } catch {
    throw new VaultSuiError(
      ERROR_CODES.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      'Ensure the file exists at the specified path'
    );
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pass = new PassThrough();

    pass.on('data', (chunk: Buffer) => chunks.push(chunk));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', (err: Error) => {
      reject(
        new VaultSuiError(
          ERROR_CODES.COMPRESSION_FAILED,
          `Compression stream error: ${err.message}`,
          'Ensure the file is readable'
        )
      );
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err: Error) => {
      reject(
        new VaultSuiError(
          ERROR_CODES.COMPRESSION_FAILED,
          `Compression failed: ${err.message}`,
          'Ensure the file exists and is readable'
        )
      );
    });
    archive.on('warning', (err: archiver.ArchiverError) => {
      reject(
        new VaultSuiError(
          ERROR_CODES.COMPRESSION_FAILED,
          `Compression warning: ${err.message}`,
          'Ensure the file exists and is readable'
        )
      );
    });

    archive.pipe(pass);
    archive.file(filePath, { name: basename(filePath) });
    void archive.finalize();
  });
}

export async function decompressBuffer(buffer: Buffer, outputDir: string): Promise<void> {
  const tmpFile = join(tmpdir(), `vaultsui-${randomBytes(4).toString('hex')}.zip`);
  await writeFile(tmpFile, buffer);
  try {
    await extractZip(tmpFile, { dir: outputDir });
  } finally {
    await unlink(tmpFile).catch(() => undefined);
  }
}
