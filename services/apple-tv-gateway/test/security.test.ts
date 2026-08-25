import { describe, expect, it } from 'vitest';
import { CloudflareAccessIdentityVerifier } from '../src/access.js';
import {
  generateUserCode,
  isAllowedEmail,
  normalizeUserCode,
  randomOpaqueToken,
  sha256Hex,
} from '../src/security.js';
import { syntheticConfig } from './helpers.js';

function base64URL(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function encodedJSON(value: unknown): string {
  return base64URL(new TextEncoder().encode(JSON.stringify(value)));
}

async function accessFixture(
  email = 'tester@example.test',
  expiresOffset = 300,
  allowedEmail = email,
) {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  if (!('privateKey' in keys)) throw new Error('Expected an asymmetric key pair.');
  const now = new Date('2026-08-25T12:00:00.000Z');
  const seconds = Math.floor(now.getTime() / 1_000);
  const header = encodedJSON({ alg: 'RS256', kid: 'synthetic-key', typ: 'JWT' });
  const payload = encodedJSON({
    aud: [syntheticConfig.accessAudience],
    email,
    exp: seconds + expiresOffset,
    iat: seconds - 10,
    iss: syntheticConfig.accessTeamDomain.origin,
    type: 'app',
  });
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keys.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const token = `${header}.${payload}.${base64URL(new Uint8Array(signature))}`;
  const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  const config = {
    ...syntheticConfig,
    allowedEmailHashes: [await sha256Hex(allowedEmail)],
  };
  const verifier = new CloudflareAccessIdentityVerifier(
    config,
    () =>
      Promise.resolve(
        Response.json({ keys: [{ ...jwk, kid: 'synthetic-key', alg: 'RS256', use: 'sig' }] }),
      ),
    () => now,
  );
  return { verifier, token };
}

describe('gateway security primitives', () => {
  it('generates opaque random values and unambiguous display codes', () => {
    expect(randomOpaqueToken()).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(generateUserCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/u);
    expect(normalizeUserCode('abcd efgh')).toBe('ABCD-EFGH');
    expect(normalizeUserCode('ABCI-0000')).toBeNull();
  });

  it('matches normalized email hashes without exposing plaintext allow-list values', async () => {
    const allowed = await sha256Hex('tester@example.test');
    await expect(isAllowedEmail(' Tester@Example.Test ', [allowed])).resolves.toBe(true);
    await expect(isAllowedEmail('outsider@example.test', [allowed])).resolves.toBe(false);
  });

  it('validates Cloudflare Access RS256 signatures, claims, and allow-list membership', async () => {
    const { verifier, token } = await accessFixture();
    await expect(
      verifier.verify(
        new Request('https://gateway.example.test/activate', {
          headers: { 'cf-access-jwt-assertion': token },
        }),
      ),
    ).resolves.toEqual({ email: 'tester@example.test' });

    const tokenParts = token.split('.');
    const signature = tokenParts[2] ?? '';
    const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = `${tokenParts[0]}.${tokenParts[1]}.${tamperedSignature}`;
    await expect(
      verifier.verify(
        new Request('https://gateway.example.test/activate', {
          headers: { 'cf-access-jwt-assertion': tampered },
        }),
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_INVALID' });

    const expired = await accessFixture('tester@example.test', -120);
    await expect(
      expired.verifier.verify(
        new Request('https://gateway.example.test/activate', {
          headers: { 'cf-access-jwt-assertion': expired.token },
        }),
      ),
    ).rejects.toMatchObject({ code: 'ACCESS_INVALID' });

    const unauthorized = await accessFixture('outsider@example.test', 300, 'tester@example.test');
    expect(unauthorized.token).not.toContain('outsider@example.test');
    await expect(
      unauthorized.verifier.verify(
        new Request('https://gateway.example.test/activate', {
          headers: { 'cf-access-jwt-assertion': unauthorized.token },
        }),
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_ALLOWED' });
  });
});
