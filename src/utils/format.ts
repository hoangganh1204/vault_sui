const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${UNITS[unitIndex]}`;
}

export function truncateAddress(address: string): string {
  if (address.length <= 17) {
    return address;
  }
  const prefix = address.slice(0, 8);
  const suffix = address.slice(-6);
  return `${prefix}...${suffix}`;
}
