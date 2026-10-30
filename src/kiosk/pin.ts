/**
 * Staff PIN logic: 4 to 8 digits, stored as sha256(salt + ":" + pin) with a random 16-byte hex salt.
 * The digest is injected (expo-crypto in the app, a fake in tests) so this file stays pure.
 */

export type Digest = (input: string) => Promise<string>;
export type RandomBytes = (length: number) => Uint8Array;

export interface StoredPin {
  salt: string;
  hash: string;
}

export const SALT_BYTES = 16;

export function isValidPin(pin: string): boolean {
  return /^[0-9]{4,8}$/.test(pin);
}

export async function hashPin(pin: string, salt: string, digest: Digest): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 8 digits');
  return digest(`${salt}:${pin}`);
}

export async function verifyPin(pin: string, stored: StoredPin, digest: Digest): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const hash = await hashPin(pin, stored.salt, digest);
  // Full-length comparison without an early exit on the first differing character.
  let diff = hash.length ^ stored.hash.length;
  const n = Math.max(hash.length, stored.hash.length);
  for (let i = 0; i < n; i += 1) diff |= (hash.charCodeAt(i) || 0) ^ (stored.hash.charCodeAt(i) || 0);
  return diff === 0;
}

export function newSalt(randomBytes: RandomBytes): string {
  return Array.from(randomBytes(SALT_BYTES), (b) => b.toString(16).padStart(2, '0')).join('');
}
