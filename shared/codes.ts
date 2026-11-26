/*
 * Verification codes: 16 characters of Crockford base32 (no I, L, O, U), 80 random bits.
 * Shown as XXXX-XXXX-XXXX-XXXX; stored and put in the QR without dashes.
 * Typed codes are forgiving: lower case, spaces and dashes are fine, O reads as 0 and I/L as 1.
 */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 16;

/** 20 hex characters (80 bits) of randomness → a 16-character code. */
export function codeFromHex(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  if (clean.length < 20) throw new Error('Not enough randomness for a code');
  let bits = '';
  for (const h of clean.slice(0, 20)) bits += Number.parseInt(h, 16).toString(2).padStart(4, '0');
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Number.parseInt(bits.slice(i * 5, i * 5 + 5), 2)];
  return out;
}

/** Normalised code, or '' if it can't be one. */
export function normalizeCode(input: string): string {
  const s = String(input ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (s.length !== CODE_LENGTH) return '';
  for (const c of s) if (!CODE_ALPHABET.includes(c)) return '';
  return s;
}

export const formatCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;

/** The address printed in the QR. `base` ends with a slash, e.g. https://dhsudr10.axiomaip.com/v/ */
export function verifyUrl(base: string, code: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${code}`;
}
