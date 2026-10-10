/**
 * WaseNet Sample Certificates & Test Fixtures
 * Provides pre-signed and deterministic test credentials for instant offline evaluation:
 * 1. Valid: Authentic Land holding certificate
 * 2. Tampered: Modified content that fails ES256 signature verification
 * 3. Revoked: Authentic signature but listed on the Document Revocation List
 * 4. Expired: Authentic signature but past validity date
 */

import { canonicalizeJson, base64UrlEncodeString, base64UrlEncode } from './crypto.js';
import { keyStore } from './storage.js';

// Sample Document Payloads
export const SAMPLE_VALID_PAYLOAD = {
  doc_id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'Land certificate',
  type_am: 'የመሬት ይዞታ ምስክር ወረቀት',
  holder_name: 'Abebe Bikila Wolde',
  holder_id: 'ET-AA-99887766',
  issuer_code: 'ET-AA-LAND-04',
  issued_at: '2026-01-15T08:30:00Z',
  expires_at: '2031-01-15T08:30:00Z',
  jurisdiction: 'Addis Ababa Bole Sub-city',
  parcel_number: 'BOL-104-9821'
};

export const SAMPLE_REVOKED_PAYLOAD = {
  doc_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  type: 'Local permit',
  type_am: 'የአካባቢ የንግድ ፈቃድ',
  holder_name: 'Chaltu Gemeda Tolessa',
  holder_id: 'ET-OR-44332211',
  issuer_code: 'ET-AA-LAND-04',
  issued_at: '2026-02-01T10:00:00Z',
  expires_at: '2028-02-01T10:00:00Z',
  business_type: 'Agricultural Logistics'
};

export const SAMPLE_EXPIRED_PAYLOAD = {
  doc_id: '7b4e9112-9c21-4f1b-8e10-112233445566',
  type: 'Cooperative credential',
  type_am: 'የሕብረት ሥራ ማስረጃ',
  holder_name: 'Dawit Yohannes Haile',
  holder_id: 'ET-FED-12345678',
  issuer_code: 'ET-AA-LAND-04',
  issued_at: '2024-01-01T09:00:00Z',
  expires_at: '2025-01-01T09:00:00Z', // Expired
  cooperative_name: 'Awash Farmers Association'
};

export const SAMPLE_TAMPERED_PAYLOAD = {
  doc_id: '8f1d4fae-3c2b-4a5e-b8d1-7c9e0f2a4b6c',
  type: 'Land certificate',
  type_am: 'የመሬት ይዞታ ምስክር ወረቀት',
  holder_name: 'Forged Identity Name',
  holder_id: 'ET-FAKE-000000',
  issuer_code: 'ET-AA-LAND-04',
  issued_at: '2026-03-01T08:00:00Z',
  expires_at: '2030-03-01T08:00:00Z'
};

/**
 * Helper to generate an active key pair and pre-sign sample documents dynamically
 * if static tokens are evaluated in the browser.
 */
let cachedSampleTokens = null;

export async function getSampleTokens(kid = 'wase-aa-2026-01') {
  if (cachedSampleTokens) return cachedSampleTokens;

  // Generate ephemeral ECDSA key pair for offline sample demonstration
  // In production, the public key is seeded in IndexedDB and private key is on server.
  const header = { alg: 'ES256', kid: kid, typ: 'JWT' };
  const headerB64 = base64UrlEncodeString(JSON.stringify(header));

  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    await keyStore.putKey({
      kid: kid,
      createdDate: '2026-01-01',
      status: 'Active',
      description: 'Active Test Authority Key 2026',
      jwk: publicJwk,
      cryptoKey: keyPair.publicKey
    });

    async function signPayload(payload) {
      const pB64 = base64UrlEncodeString(canonicalizeJson(payload));
      const signingInput = `${headerB64}.${pB64}`;
      const encoder = new TextEncoder();
      const sigBuffer = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyPair.privateKey,
        encoder.encode(signingInput)
      );
      const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));
      return `${signingInput}.${sigB64}`;
    }

    const validToken = await signPayload(SAMPLE_VALID_PAYLOAD);
    const revokedToken = await signPayload(SAMPLE_REVOKED_PAYLOAD);
    const expiredToken = await signPayload(SAMPLE_EXPIRED_PAYLOAD);

    // Tampered token: take valid token, modify the payload, but keep original signature
    const validParts = validToken.split('.');
    const tamperedPayloadB64 = base64UrlEncodeString(canonicalizeJson(SAMPLE_TAMPERED_PAYLOAD));
    const tamperedToken = `${validParts[0]}.${tamperedPayloadB64}.${validParts[2]}`;

    cachedSampleTokens = {
      valid: validToken,
      revoked: revokedToken,
      expired: expiredToken,
      tampered: tamperedToken,
      unreadable: 'CORRUPTED_NOT_A_JWS_TOKEN_###@@@'
    };

    return cachedSampleTokens;
  } catch (err) {
    console.error('Failed to generate sample tokens:', err);
    return null;
  }
}
