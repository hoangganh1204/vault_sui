import { nanoid } from 'nanoid';

const VAULT_ID_REGEX = /^v_[A-Za-z0-9_-]{6}$/;

export function generateVaultId(): string {
  return `v_${nanoid(6)}`;
}

export function validateVaultId(id: string): boolean {
  return VAULT_ID_REGEX.test(id);
}
