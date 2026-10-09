import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  canonicalizeJson,
  computeSha256,
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeString,
  base64UrlDecodeString,
  createJwsCompact
} from '../frontend/src/crypto.js';

test('RFC 8785 Deterministic Canonical JSON stringification', () => {
  const uncanonical = {
    z_field: 'last',
    a_field: 'first',
    m_nested: {
      b: 2,
      a: 1
    },
    items: [3, 2, 1]
  };

  const canonical = canonicalizeJson(uncanonical);
  const expected = '{"a_field":"first","items":[3,2,1],"m_nested":{"a":1,"b":2},"z_field":"last"}';

  assert.equal(canonical, expected, 'Object keys must be sorted lexicographically and whitespace removed');
});

test('Canonical JSON handles primitive and edge types', () => {
  assert.equal(canonicalizeJson(null), 'null');
  assert.equal(canonicalizeJson(123), '123');
  assert.equal(canonicalizeJson('hello'), '"hello"');
  assert.equal(canonicalizeJson([]), '[]');
  assert.equal(canonicalizeJson({}), '{}');
});

test('Base64URL encoding and decoding (RFC 7515 / RFC 4648)', () => {
  const sampleText = 'WaseNet Ethiopia Public Registry @ 2026';
  const encoded = base64UrlEncodeString(sampleText);

  // Must not contain +, /, or =
  assert.ok(!encoded.includes('+'), 'Must not contain +');
  assert.ok(!encoded.includes('/'), 'Must not contain /');
  assert.ok(!encoded.includes('='), 'Must not contain padding =');

  const decoded = base64UrlDecodeString(encoded);
  assert.equal(decoded, sampleText);
});

test('SHA-256 calculation matches standard vector', async () => {
  const testInput = 'WaseNet';
  const { hex } = await computeSha256(testInput);

  // Standard SHA-256 of "WaseNet"
  const expectedHex = crypto.createHash('sha256').update(testInput).digest('hex');
  assert.equal(hex, expectedHex);
  assert.equal(hex.length, 64);
});

test('JWS Compact Serialization produces valid 3-part token with ES256', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });

  const jwkPrivate = privateKey.export({ format: 'jwk' });
  const payload = {
    doc_id: 'test-123',
    holder_name: 'Abebe Bikila',
    issuer_code: 'ET-AA-LAND-04'
  };

  const jws = await createJwsCompact(payload, jwkPrivate, 'test-kid-01');
  const parts = jws.split('.');

  assert.equal(parts.length, 3, 'JWS compact serialization must have exactly 3 parts');

  const header = JSON.parse(base64UrlDecodeString(parts[0]));
  assert.equal(header.alg, 'ES256', 'Header alg must be ES256');
  assert.equal(header.kid, 'test-kid-01', 'Header kid must match provided kid');

  const decodedPayload = JSON.parse(base64UrlDecodeString(parts[1]));
  assert.equal(decodedPayload.doc_id, 'test-123');
  assert.equal(decodedPayload.holder_name, 'Abebe Bikila');
});
