import { createHash } from 'node:crypto';

export function computeChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function verifyChecksum(data: Buffer, expected: string): boolean {
  return computeChecksum(data) === expected;
}
