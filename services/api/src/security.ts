const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/iu.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const subtle = crypto.subtle;
  if ('timingSafeEqual' in subtle && typeof subtle.timingSafeEqual === 'function') {
    if (left.byteLength !== right.byteLength) return !subtle.timingSafeEqual(left, left);
    return subtle.timingSafeEqual(left, right);
  }
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function sha256(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function safeStringEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  return constantTimeEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

export function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = new Uint8Array(6);
  crypto.getRandomValues(random);
  return [...random].map((value) => alphabet[value % alphabet.length] ?? 'A').join('');
}

export function generateDeviceToken(): string {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return toHex(random);
}

export async function verifyStreamWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: Date,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (signatureHeader === null) return false;
  const fields = new Map(
    signatureHeader.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key ?? '', value.join('=')] as const;
    }),
  );
  const timestamp = Number(fields.get('time'));
  const signature = fields.get('sig1');
  if (!Number.isInteger(timestamp) || signature === undefined) return false;
  if (Math.abs(Math.floor(now.getTime() / 1_000) - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)),
  );
  const provided = fromHex(signature);
  return provided !== null && constantTimeEqual(expected, provided);
}
