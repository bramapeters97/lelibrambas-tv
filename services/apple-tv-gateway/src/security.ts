const encoder = new TextEncoder();
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64URL(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function safeStringEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  if ('timingSafeEqual' in crypto.subtle && typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(leftBytes, rightBytes);
  }
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function randomOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64URL(bytes);
}

export function generateUserCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const compact = [...bytes].map((byte) => USER_CODE_ALPHABET[byte & 31] ?? 'A').join('');
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function normalizeUserCode(value: string): string | null {
  const compact = value.toUpperCase().replace(/[^A-Z2-9]/gu, '');
  if (
    compact.length !== 8 ||
    [...compact].some((character) => !USER_CODE_ALPHABET.includes(character))
  ) {
    return null;
  }
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function maskEmail(value: string): string {
  const normalized = normalizeEmail(value);
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) return 'approved account';
  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  return `${local.slice(0, 1)}•••@${domain}`;
}

export async function hmacSHA256Hex(keyMaterial: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

export async function isAllowedEmail(
  email: string,
  allowedHashes: readonly string[],
): Promise<boolean> {
  const candidate = await sha256Hex(normalizeEmail(email));
  const decisions = await Promise.all(
    allowedHashes.map((allowed) => safeStringEqual(candidate, allowed)),
  );
  return decisions.some(Boolean);
}

export function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  for (const segment of cookie.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() === name) return segment.slice(separator + 1).trim();
  }
  return null;
}
