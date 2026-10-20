import React, { useState, useEffect } from 'react';
import {
  canonicalizeJson,
  computeSha256,
  createJwsCompact,
  verifyDocumentCredential,
  base64UrlEncodeString
} from '../crypto.js';
import { keyStore, drlStore } from '../storage.js';

export default function TestPage() {
  const [testResults, setTestResults] = useState([]);
  const [running, setRunning] = useState(false);

  const runAllTests = async () => {
    setRunning(true);
    const results = [];

    function assert(name, condition, details = '') {
      results.push({
        name,
        passed: Boolean(condition),
        details: details ? String(details) : (condition ? 'Passed' : 'Assertion failed')
      });
    }

    try {
      // Test 1: Deterministic Canonical JSON sorting
      const uncanonical = { z: 1, a: 2, m: { b: 3, a: 4 }, list: [3, 2, 1] };
      const canonical = canonicalizeJson(uncanonical);
      const expected = '{"a":2,"list":[3,2,1],"m":{"a":4,"b":3},"z":1}';
      assert(
        'Canonical JSON key sorting & whitespace removal',
        canonical === expected,
        `Result: ${canonical}`
      );

      // Test 2: Canonical JSON handles empty objects & special types
      const emptyCan = canonicalizeJson({});
      assert('Canonical JSON empty object', emptyCan === '{}');

      // Test 3: SHA-256 computation
      const testString = 'WaseNet Ethiopia 2026';
      const hashResult = await computeSha256(testString);
      assert(
        'SHA-256 hash output format',
        hashResult.hex && hashResult.hex.length === 64,
        `Hash: ${hashResult.hex}`
      );

      // Test 4: ES256 key generation & JWS Compact serialization
      const testKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
      const testJwk = await crypto.subtle.exportKey('jwk', testKeyPair.publicKey);

      const testKid = 'test-unit-key-01';
      await keyStore.putKey({
        kid: testKid,
        createdDate: '2026-01-01',
        status: 'Active',
        jwk: testJwk,
        cryptoKey: testKeyPair.publicKey
      });

      const sampleDoc = {
        doc_id: 'test-doc-12345',
        type: 'Land certificate',
        holder_name: 'Almaz Ayana Kebede',
        holder_id: 'ET-AA-123456',
        issuer_code: 'ET-AA-LAND-04',
        issued_at: '2026-01-01T08:00:00Z',
        expires_at: '2030-01-01T08:00:00Z'
      };

      const jws = await createJwsCompact(sampleDoc, testKeyPair.privateKey, testKid);
      const jwsParts = jws.split('.');
      assert('JWS compact serialization has 3 parts', jwsParts.length === 3);

      // Test 5: Signature verification of valid document
      const validVerify = await verifyDocumentCredential(jws, keyStore, drlStore);
      assert(
        'Valid document verification resolves to VALID',
        validVerify.status === 'VALID',
        `Status: ${validVerify.status}`
      );

      // Test 6: Tampered document check (modified payload with original signature)
      const tamperedPayload = { ...sampleDoc, holder_name: 'Modified Identity' };
      const tamperedPayloadB64 = base64UrlEncodeString(canonicalizeJson(tamperedPayload));
      const tamperedJws = `${jwsParts[0]}.${tamperedPayloadB64}.${jwsParts[2]}`;

      const tamperedVerify = await verifyDocumentCredential(tamperedJws, keyStore, drlStore);
      assert(
        'Tampered document resolves to TAMPERED (never VALID)',
        tamperedVerify.status === 'TAMPERED',
        `Status: ${tamperedVerify.status}`
      );

      // Test 7: Tampered document is NEVER recognized as revoked or expired
      assert(
        'Tampered document is NEVER misidentified as REVOKED or EXPIRED',
        tamperedVerify.status !== 'REVOKED' && tamperedVerify.status !== 'EXPIRED'
      );

      // Test 8: Revoked document check
      const revokedDocId = 'revoked-test-999';
      const revokedDoc = { ...sampleDoc, doc_id: revokedDocId };
      const revokedJws = await createJwsCompact(revokedDoc, testKeyPair.privateKey, testKid);

      await drlStore.revokeDocument(revokedDocId, 'Reported stolen', 99);
      const revokedVerify = await verifyDocumentCredential(revokedJws, keyStore, drlStore);
      assert(
        'Revoked document resolves to REVOKED',
        revokedVerify.status === 'REVOKED',
        `Status: ${revokedVerify.status}`
      );

      // Test 9: Expired document check
      const expiredDocId = 'expired-test-888';
      const expiredDoc = {
        ...sampleDoc,
        doc_id: expiredDocId,
        expires_at: '2024-01-01T00:00:00Z' // Past date
      };
      const expiredJws = await createJwsCompact(expiredDoc, testKeyPair.privateKey, testKid);
      const expiredVerify = await verifyDocumentCredential(expiredJws, keyStore, drlStore);
      assert(
        'Expired document resolves to EXPIRED',
        expiredVerify.status === 'EXPIRED',
        `Status: ${expiredVerify.status}`
      );

      // Test 10: Unknown kid rejection
      const unknownKidHeader = base64UrlEncodeString(
        JSON.stringify({ alg: 'ES256', kid: 'non-existent-kid', typ: 'JWT' })
      );
      const unknownKidJws = `${unknownKidHeader}.${jwsParts[1]}.${jwsParts[2]}`;
      const unknownVerify = await verifyDocumentCredential(unknownKidJws, keyStore, drlStore);
      assert(
        'Untrusted kid is rejected as TAMPERED',
        unknownVerify.status === 'TAMPERED'
      );

      // Test 11: Algorithm non-ES256 rejection (e.g. "none" algorithm attack)
      const noneAlgHeader = base64UrlEncodeString(
        JSON.stringify({ alg: 'none', kid: testKid, typ: 'JWT' })
      );
      const noneAlgJws = `${noneAlgHeader}.${jwsParts[1]}.`;
      const noneVerify = await verifyDocumentCredential(noneAlgJws, keyStore, drlStore);
      assert(
        'Algorithm "none" attack rejected as TAMPERED',
        noneVerify.status === 'TAMPERED'
      );

      // Test 12: Corrupted or unparseable string returns UNREADABLE
      const unreadableVerify = await verifyDocumentCredential(
        'NOT_A_VALID_JWS_TOKEN',
        keyStore,
        drlStore
      );
      assert(
        'Malformed QR content resolves to UNREADABLE (no crash)',
        unreadableVerify.status === 'UNREADABLE'
      );
    } catch (err) {
      assert('Fatal test runner exception', false, err.message);
    }

    setTestResults(results);
    setRunning(false);
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)'
        }}
      >
        <div>
          <h1>WaseNet Cryptographic Test Suite</h1>
          <p className="muted-text">
            Validates canonicalization, SHA-256, JWS ES256 signature verification, and 4-state result logic.
          </p>
        </div>
        <div>
          <button
            onClick={runAllTests}
            disabled={running}
            className="btn btn-primary"
          >
            {running ? 'Running tests…' : 'Re-run all tests'}
          </button>
        </div>
      </div>

      {totalCount > 0 && (
        <div
          className="panel"
          style={{
            backgroundColor: passedCount === totalCount ? '#EBF3EE' : '#FDF3F2',
            borderLeft: `4px solid ${passedCount === totalCount ? 'var(--status-valid)' : 'var(--status-tampered)'}`,
            marginBottom: 'var(--space-4)'
          }}
        >
          <strong style={{ color: passedCount === totalCount ? 'var(--status-valid)' : 'var(--status-tampered)' }}>
            {passedCount} of {totalCount} tests passed ({Math.round((passedCount / totalCount) * 100)}%)
          </strong>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table" aria-label="Unit test results">
          <thead>
            <tr>
              <th>Status</th>
              <th>Test Specification</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {testResults.map((t, idx) => (
              <tr key={idx}>
                <td data-label="Status">
                  <span className={`tag-status ${t.passed ? 'valid' : 'tampered'}`}>
                    {t.passed ? 'PASS' : 'FAIL'}
                  </span>
                </td>
                <td data-label="Test Specification"><strong>{t.name}</strong></td>
                <td data-label="Details" className="muted-text" style={{ fontSize: '0.85rem' }}>{t.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
