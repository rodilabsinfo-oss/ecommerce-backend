import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

// scrypt settings (memory-hard, built into Node — no native add-on needed).
const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_LEN = 64;
const opts = { N, r, p, maxmem: 128 * N * r * 2 };

/** Stored as "scrypt$N$r$p$salt$hash" so settings can change later without breaking old passwords. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN, opts);
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, n, rr, pp, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const N2 = Number(n);
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: N2,
    r: Number(rr),
    p: Number(pp),
    maxmem: 128 * N2 * Number(rr) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Random token for a session; only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString('base64url');
