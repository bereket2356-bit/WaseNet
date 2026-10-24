/**
 * WaseNet Signing Provider Interface (NFR-S2, NFR-P2)
 * Decouples the signing mechanism so signing can occur on a secure server or on a hardware enclave.
 * Private keys are NEVER stored in IndexedDB, localStorage, or verifier code.
 */

import { canonicalizeJson, computeSha256, createJwsCompact } from './crypto.js';
import { API_BASE_URL } from './api-config.js';

export class SigningProvider {
  /**
   * @param {Object} documentPayload - Plain document data object
   * @param {string} kid - Target key identifier
   * @param {string} authToken - Issuer JWT session token
   * @returns {Promise<{ jws: string, canonicalJson: string, hashHex: string }>}
   */
  async signDocument(documentPayload, kid, authToken) {
    throw new Error('signDocument must be implemented by concrete provider');
  }
}

/**
 * ServerSigningProvider
 * Transmits the document payload to the authenticated backend signing endpoint.
 * Private key remains exclusively on the secure server.
 */
export class ServerSigningProvider extends SigningProvider {
  constructor(apiBaseUrl = '') {
    super();
    this.apiBaseUrl = apiBaseUrl;
  }

  async signDocument(documentPayload, kid = 'wase-aa-2026-01', authToken = '') {
    const canonicalJson = canonicalizeJson(documentPayload);
    const { hex: hashHex } = await computeSha256(canonicalJson);

    const response = await fetch(`${this.apiBaseUrl}/api/issue/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        payload: documentPayload,
        kid: kid,
        hashHex: hashHex
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server signing failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      jws: data.jws,
      canonicalJson,
      hashHex
    };
  }
}

/**
 * IsolatedMockHardwareSigningProvider
 * Simulates an isolated cryptographic hardware security module / smart card attached to the counter PC.
 * Holds an ephemeral key in volatile runtime memory only (NEVER written to IndexedDB or localStorage).
 */
export class IsolatedMockHardwareSigningProvider extends SigningProvider {
  constructor() {
    super();
    this.memoryKey = null;
  }

  async initKey() {
    if (!this.memoryKey && typeof crypto !== 'undefined' && crypto.subtle) {
      this.memoryKey = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
    }
  }

  async signDocument(documentPayload, kid = 'wase-aa-2026-01') {
    const canonicalJson = canonicalizeJson(documentPayload);
    const { hex: hashHex } = await computeSha256(canonicalJson);

    await this.initKey();

    let jws;
    if (this.memoryKey) {
      jws = await createJwsCompact(documentPayload, this.memoryKey.privateKey, kid);
    } else {
      throw new Error('WebCrypto not available for hardware signing simulation');
    }

    return { jws, canonicalJson, hashHex };
  }
}

// Active provider instance singleton
let activeProvider = new ServerSigningProvider(API_BASE_URL);

export function getSigningProvider() {
  return activeProvider;
}

export function setSigningProvider(provider) {
  activeProvider = provider;
}
