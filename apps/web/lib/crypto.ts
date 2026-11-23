import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { requireServerEnv } from '@/lib/env';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function base64UrlSha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function encryptionKey(): Buffer {
  const encoded = requireServerEnv('LAUNCHPROOF_ENCRYPTION_KEY');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('LAUNCHPROOF_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

/** AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext>, all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Invalid encrypted value.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
