export const ERROR_CODES = {
  FILE_NOT_FOUND: 'E001',
  WALLET_NOT_CONFIGURED: 'E002',
  INVALID_ADDRESS: 'E003',
  UNAUTHORIZED: 'E004',
  UPLOAD_FAILED: 'E005',
  COMPRESSION_FAILED: 'E006',
  VAULT_NOT_FOUND: 'E007',
  VAULT_EXPIRED: 'E008',
  CHECKSUM_MISMATCH: 'E009',
  DOWNLOAD_FAILED: 'E010',
  DECRYPTION_FAILED: 'E011',
  BLOB_UNAVAILABLE: 'E012',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class VaultSuiError extends Error {
  public readonly code: ErrorCode;
  public readonly fix: string;

  constructor(code: ErrorCode, message: string, fix: string) {
    super(message);
    this.name = 'VaultSuiError';
    this.code = code;
    this.fix = fix;
    Object.setPrototypeOf(this, VaultSuiError.prototype);
  }
}
