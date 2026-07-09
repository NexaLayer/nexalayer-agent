import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_ROUNDS = 12;

function getEncryptionKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  return crypto
    .createHash('sha256')
    .update(key)
    .digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    encrypted,
    tag.toString('hex'),
  ].join(':');
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encryptedHex, tagHex] =
    ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM, key, iv
  );
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(
    encryptedHex, 'hex', 'utf8'
  );
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(24).toString('hex')}`;
}

export function generateApiSecret(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

export async function hashSecret(
  secret: string
): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function verifySecret(
  secret: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
