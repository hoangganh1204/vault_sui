import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readFileAsync(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function writeFileAsync(filePath: string, data: Buffer): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, data);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}
