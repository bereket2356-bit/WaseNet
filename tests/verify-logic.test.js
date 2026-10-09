import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  canonicalizeJson,
  createJwsCompact,
  verifyDocumentCredential,
  base64UrlEncodeString
} from '../frontend/src/crypto.js';

// Mock Key Store for Test Runner
class MockKeyStore {
  constructor() {
    this.keys = new Map();
  }
  async getKey(kid) {
    return this.keys.get(kid) || null;
  }
  setKey(kid, keyRecord) {
    this.keys.set(kid, keyRecord);
  }
}

// Mock DRL Store for Test Runner
class MockDrlStore {
  constructor() {
    this.revoked = new Map();
  }
  async isRevoked(docId) {
    return this.revoked.get(docId) || null;
  }
  revoke(docId, reason = 'Revoked by authority') {
    this.revoked.set(docId, { doc_id: docId, reason });
  }
}

test('4-State Verification Logic and Precedence Rules', async (t) => {
  const keyStore = new MockKeyStore();
  const drlStore = new MockDrlStore();

  // Setup test ES256 key
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });
  const jwkPublic = publicKey.export({ format: 'jwk' });
  const jwkPrivate = privateKey.export({ format: 'jwk' });
  const testKid = 'wase-test-key-2026';

  keyStore.setKey(testKid, {
    kid: testKid,
    status: 'Active',
    jwk: jwkPublic
  });

  const baseDoc = {
    doc_id: 'doc-valid-001',
    type: 'Land certificate',
    holder_name: 'Abebe Bikila Wolde',
    holder_id: 'ET-AA-99887766',
    issuer_code: 'ET-AA-LAND-04',
    issued_at: '2026-01-01T08:00:00Z',
    expires_at: '2031-01-01T08:00:00Z'
  };

  await t.test('1. Valid document verification', async () => {
    const validJws = await createJwsCompact(baseDoc, jwkPrivate, testKid);
    const result = await verifyDocumentCredential(validJws, keyStore, drlStore);

    assert.equal(result.status, 'VALID', 'Authentic document must be VALID');
    assert.equal(result.docId, 'doc-valid-001');
    assert.equal(result.payload.holder_name, 'Abebe Bikila Wolde');
  });

  await t.test('2. Tampered content detection (signature mismatch)', async () => {
    const validJws = await createJwsCompact(baseDoc, jwkPrivate, testKid);
    const parts = validJws.split('.');

    // Tamper with payload (modify holder name)
    const tamperedPayload = { ...baseDoc, holder_name: 'Fraudulent Holder' };
    const tamperedPayloadB64 = base64UrlEncodeString(canonicalizeJson(tamperedPayload));
    const tamperedJws = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const result = await verifyDocumentCredential(tamperedJws, keyStore, drlStore);
    assert.equal(result.status, 'TAMPERED', 'Modified payload must resolve to TAMPERED');
  });

  await t.test('3. CRITICAL RULE: Tampered document must NEVER display as VALID, REVOKED, or EXPIRED', async () => {
    // Document that is also on the revocation list and past expiry, but has a bad signature!
    const tamperedRevokedDoc = {
      ...baseDoc,
      doc_id: 'doc-revoked-and-tampered',
      expires_at: '2020-01-01T00:00:00Z' // Expired in the past
    };
    drlStore.revoke('doc-revoked-and-tampered', 'Stolen');

    const validJws = await createJwsCompact(tamperedRevokedDoc, jwkPrivate, testKid);
    const parts = validJws.split('.');

    // Corrupt signature part
    const badSignatureJws = `${parts[0]}.${parts[1]}.CORRUPTED_SIGNATURE_BYTES`;
    const result = await verifyDocumentCredential(badSignatureJws, keyStore, drlStore);

    assert.equal(result.status, 'TAMPERED', 'Must fail at signature check first');
    assert.notEqual(result.status, 'VALID', 'Tampered document must never display as VALID');
    assert.notEqual(result.status, 'REVOKED', 'Tampered document must never display as REVOKED');
    assert.notEqual(result.status, 'EXPIRED', 'Tampered document must never display as EXPIRED');
  });

  await t.test('4. Revoked document check (authentic signature but on DRL)', async () => {
    const revokedDoc = {
      ...baseDoc,
      doc_id: 'doc-revoked-002',
      expires_at: '2031-01-01T08:00:00Z'
    };
    drlStore.revoke('doc-revoked-002', 'Cancelled by court order');

    const jws = await createJwsCompact(revokedDoc, jwkPrivate, testKid);
    const result = await verifyDocumentCredential(jws, keyStore, drlStore);

    assert.equal(result.status, 'REVOKED', 'Authentic document on DRL must resolve to REVOKED');
    assert.equal(result.docId, 'doc-revoked-002');
  });

  await t.test('5. Expired document check (authentic signature, not on DRL, but past date)', async () => {
    const expiredDoc = {
      ...baseDoc,
      doc_id: 'doc-expired-003',
      expires_at: '2025-01-01T00:00:00Z' // Expired
    };

    const jws = await createJwsCompact(expiredDoc, jwkPrivate, testKid);
    const result = await verifyDocumentCredential(jws, keyStore, drlStore);

    assert.equal(result.status, 'EXPIRED', 'Authentic past-due document must resolve to EXPIRED');
  });

  await t.test('6. Security: Rejection of algorithm "none" and other algorithms', async () => {
    const noneHeader = base64UrlEncodeString(JSON.stringify({ alg: 'none', kid: testKid, typ: 'JWT' }));
    const payloadB64 = base64UrlEncodeString(canonicalizeJson(baseDoc));
    const noneJws = `${noneHeader}.${payloadB64}.`;

    const result = await verifyDocumentCredential(noneJws, keyStore, drlStore);
    assert.equal(result.status, 'TAMPERED', 'Algorithm "none" must be rejected as TAMPERED');
  });

  await t.test('7. Security: Rejection of unknown or revoked kid', async () => {
    const validJws = await createJwsCompact(baseDoc, jwkPrivate, testKid);
    const parts = validJws.split('.');

    const rogueHeader = base64UrlEncodeString(JSON.stringify({ alg: 'ES256', kid: 'rogue-unknown-kid', typ: 'JWT' }));
    const rogueJws = `${rogueHeader}.${parts[1]}.${parts[2]}`;

    const result = await verifyDocumentCredential(rogueJws, keyStore, drlStore);
    assert.equal(result.status, 'TAMPERED', 'Unknown kid must be rejected as TAMPERED');
  });

  await t.test('8. Robustness: Malformed QR payload resolves to UNREADABLE without crash', async () => {
    const badTokens = [
      '',
      null,
      'gibberish-string',
      'a.b',
      'invalid.base64!!.sig',
      'https://malicious-site.com/fake'
    ];

    for (const bad of badTokens) {
      const result = await verifyDocumentCredential(bad, keyStore, drlStore);
      assert.ok(
        result.status === 'UNREADABLE' || result.status === 'TAMPERED',
        `Bad token "${bad}" should return UNREADABLE or TAMPERED, got ${result.status}`
      );
    }
  });
});
