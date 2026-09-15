/**
 * Tokens and passwords. Nothing clever, and nothing home-made where the
 * platform already has it.
 *
 * A token is 32 random bytes, base64url, and only its SHA-256 is stored. A
 * password is scrypt with a random salt, stored as one string that carries
 * its own parameters so they can be raised later without a migration.
 */
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = (password: string, salt: string, keylen: number, cost: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, { N: cost }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

/** A fresh token for a link or a session. 256 bits, URL safe. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** What the database keeps instead of the token itself. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const SCRYPT_COST = 16384; // N
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, SCRYPT_COST);
  return `scrypt$${SCRYPT_COST}$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, encoded] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'base64url');
  const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, Number(cost));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
