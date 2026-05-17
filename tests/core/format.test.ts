import { formatBytes, truncateAddress } from '../../src/utils/format.js';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatBytes(4_404_019)).toBe('4.2 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 3)).toBe('3.0 GB');
  });

  it('handles fractional KB correctly', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('truncateAddress', () => {
  it('truncates a 0x-prefixed 64-char address', () => {
    const addr = '0xABCDEF0123456789abcdef0123456789ABCDEF0123456789abcdef0123456789';
    expect(truncateAddress(addr)).toBe('0xABCDEF...456789');
  });

  it('returns the address unchanged if shorter than truncation length', () => {
    expect(truncateAddress('0xABC')).toBe('0xABC');
  });

  it('produces 0xXXXXXX...YYYYYY pattern (6 head + 6 tail)', () => {
    const addr = '0x' + 'a'.repeat(64);
    const result = truncateAddress(addr);
    expect(result).toMatch(/^0x[a-fA-F0-9]{6}\.{3}[a-fA-F0-9]{6}$/);
  });
});
