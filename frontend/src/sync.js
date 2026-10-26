/**
 * WaseNet Sync Engine (FR-4.1, FR-4.2, FR-5.2, FR-2.5)
 * Handles idempotent synchronization of public keys, revocation deltas,
 * queued offline issuances, and audit log batches with exponential backoff.
 */

import { keyStore, drlStore, auditStore, queueStore, metaStore } from './storage.js';
import { getToken } from './auth.js';
import { apiUrl, fetchApi } from './api-config.js';

let isSyncing = false;
let backoffDelay = 2000; // Starts at 2 seconds
const MAX_BACKOFF = 60000; // Cap at 60 seconds

export async function getSyncStatus() {
  const lastSync = await metaStore.get('last_sync_timestamp', null);
  const drlVersion = await metaStore.get('drl_version', 1);
  const keyVersion = await metaStore.get('key_bundle_version', 1);
  const pending = await queueStore.getAllPending();

  return {
    online: navigator.onLine,
    lastSync,
    drlVersion,
    keyVersion,
    pendingQueueCount: pending.length
  };
}

/**
 * Executes a full idempotent synchronization pass
 */
export async function syncRegistry(force = false) {
  if (isSyncing) return { status: 'busy' };
  if (!navigator.onLine && !force) {
    return { status: 'offline', error: 'Connect to the internet to sync.' };
  }

  isSyncing = true;
  window.dispatchEvent(new CustomEvent('syncstart'));

  try {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    // 1. Fetch Public Key Bundle
    try {
      const keyRes = await fetchApi('/api/v1/keys/bundle');
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        if (keyData.keys && keyData.keys.length > 0) {
          const mappedKeys = keyData.keys.map(k => ({
            kid: k.kid,
            jwk: k.public_key_jwk || k.jwk,
            status: k.status === 'active' ? 'Active' : k.status,
            algorithm: k.algorithm || 'ES256',
            createdDate: k.created_at ? k.created_at.split('T')[0] : '2026-01-01'
          }));
          await keyStore.putKeysBatch(mappedKeys);
        }
        if (keyData.version) {
          await metaStore.set('key_bundle_version', keyData.version);
        }
      }
    } catch (e) {
      console.warn('Key bundle sync deferred:', e.message);
    }

    // 2. Fetch Revocation List Delta
    const currentDrlVer = await metaStore.get('drl_version', 0);
    try {
      const drlRes = await fetchApi(`/api/v1/revocations?since=${currentDrlVer}`);
      if (drlRes.ok) {
        const drlData = await drlRes.json();
        if (drlData.delta && drlData.delta.length > 0) {
          for (const item of drlData.delta) {
            await drlStore.revokeDocument(item.doc_id, item.reason || 'Revoked', item.revocation_version || drlData.version);
          }
        }
        if (drlData.version) {
          await metaStore.set('drl_version', drlData.version);
        }
      }
    } catch (e) {
      console.warn('DRL delta sync deferred:', e.message);
    }

    // 3. Upload Queued Offline Issuance Documents (FR-2.5)
    const pendingDocs = await queueStore.getAllPending();
    if (pendingDocs.length > 0) {
      try {
        const queueRes = await fetch(apiUrl('/api/issue/sync'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ documents: pendingDocs })
        });
        if (queueRes.ok) {
          const syncResult = await queueRes.json();
          // Remove confirmed synced documents from offline queue
          for (const doc of pendingDocs) {
            await queueStore.removePending(doc.doc_id);
          }
        }
      } catch (e) {
        console.warn('Issuance queue sync deferred:', e.message);
      }
    }

    // 4. Upload Unsent Audit Records (FR-5.2)
    const unsentAudit = await auditStore.getUnsentRecords(50);
    if (unsentAudit.length > 0) {
      try {
        const auditRes = await fetch(apiUrl('/api/audit/batch'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ records: unsentAudit })
        });
        if (auditRes.ok) {
          const uploadedIds = unsentAudit.map((r) => r.id);
          await auditStore.markAsUploaded(uploadedIds);
        }
      } catch (e) {
        console.warn('Audit upload deferred:', e.message);
      }
    }

    // Update sync timestamp
    const nowIso = new Date().toISOString();
    await metaStore.set('last_sync_timestamp', nowIso);

    // Reset backoff on successful pass
    backoffDelay = 2000;

    const summary = await getSyncStatus();
    window.dispatchEvent(new CustomEvent('synccomplete', { detail: summary }));
    return { status: 'success', summary };
  } catch (err) {
    // Implement exponential backoff for background auto-retry
    backoffDelay = Math.min(backoffDelay * 2, MAX_BACKOFF);
    window.dispatchEvent(new CustomEvent('syncerror', { detail: { error: err.message } }));
    return { status: 'error', error: err.message };
  } finally {
    isSyncing = false;
  }
}

// Background event listeners for network changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('networkchange', { detail: { online: true } }));
    setTimeout(() => syncRegistry(), backoffDelay);
  });

  window.addEventListener('offline', () => {
    window.dispatchEvent(new CustomEvent('networkchange', { detail: { online: false } }));
  });
}
