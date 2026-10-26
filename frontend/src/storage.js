/**
 * WaseNet Storage Module (IndexedDB)
 * Stores publicKeys, drl (Document Revocation List), auditLog, and issuanceQueue.
 * All writes are transaction-safe (NFR-R2).
 * Private keys are NEVER stored here (NFR-S2).
 */

const DB_NAME = 'wasenet_db';
const DB_VERSION = 1;

// Device identifier (FR-5.1)
const DEVICE_ID_KEY = 'wase_device_id';

export function getOrCreateDeviceId() {
  let deviceId = null;
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'dev-' + crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
  } catch (e) {
    deviceId = 'dev-fallback-' + Math.random().toString(36).substring(2, 10);
  }
  return deviceId;
}

let dbInstance = null;

export async function openDatabase() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. publicKeys store: keyed by 'kid'
      if (!db.objectStoreNames.contains('publicKeys')) {
        db.createObjectStore('publicKeys', { keyPath: 'kid' });
      }

      // 2. drl (Document Revocation List): keyed by 'doc_id'
      if (!db.objectStoreNames.contains('drl')) {
        const drlStore = db.createObjectStore('drl', { keyPath: 'doc_id' });
        drlStore.createIndex('version', 'version', { unique: false });
      }

      // 3. auditLog: auto-incrementing id
      if (!db.objectStoreNames.contains('auditLog')) {
        const auditStore = db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
        auditStore.createIndex('uploaded', 'uploaded', { unique: false });
        auditStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 4. issuanceQueue: offline created docs waiting to sync
      if (!db.objectStoreNames.contains('issuanceQueue')) {
        const queueStore = db.createObjectStore('issuanceQueue', { keyPath: 'doc_id' });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 5. meta store: stores sync timestamps and versions
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error('Failed to open IndexedDB: ' + event.target.error));
    };
  });
}

// Transaction Helper
async function runTransaction(storeNames, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));

    try {
      result = callback(tx);
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}

// ---------------- Public Keys API ---------------- //
export const keyStore = {
  async getKey(kid) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('publicKeys', 'readonly');
      const store = tx.objectStore('publicKeys');
      const req = store.get(kid);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllKeys() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('publicKeys', 'readonly');
      const store = tx.objectStore('publicKeys');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async putKey(keyRecord) {
    return runTransaction('publicKeys', 'readwrite', (tx) => {
      const store = tx.objectStore('publicKeys');
      store.put(keyRecord);
    });
  },

  async putKeysBatch(keyRecords) {
    return runTransaction('publicKeys', 'readwrite', (tx) => {
      const store = tx.objectStore('publicKeys');
      for (const rec of keyRecords) {
        store.put(rec);
      }
    });
  }
};

// ---------------- Document Revocation List (DRL) API ---------------- //
export const drlStore = {
  async isRevoked(docId) {
    if (!docId) return null;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drl', 'readonly');
      const store = tx.objectStore('drl');
      const req = store.get(docId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllRevoked() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drl', 'readonly');
      const store = tx.objectStore('drl');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async revokeDocument(docId, reason, version) {
    return runTransaction('drl', 'readwrite', (tx) => {
      const store = tx.objectStore('drl');
      store.put({
        doc_id: docId,
        reason: reason || 'Revoked by authority',
        revokedAt: new Date().toISOString(),
        version: version || 1
      });
    });
  },

  async applyDelta(revokedList) {
    return runTransaction('drl', 'readwrite', (tx) => {
      const store = tx.objectStore('drl');
      for (const item of revokedList) {
        store.put(item);
      }
    });
  }
};

// ---------------- Audit Log API (FR-5.1) ---------------- //
export const auditStore = {
  async addRecord(docId, resultStatus) {
    const deviceId = getOrCreateDeviceId();
    const record = {
      doc_id: docId || 'unreadable',
      timestamp: new Date().toISOString(),
      result: resultStatus, // Valid, Tampered, Revoked, Expired, Unreadable
      deviceId: deviceId,
      uploaded: false
    };

    return runTransaction('auditLog', 'readwrite', (tx) => {
      const store = tx.objectStore('auditLog');
      store.add(record);
    });
  },

  async getRecords(filter = 'All') {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('auditLog', 'readonly');
      const store = tx.objectStore('auditLog');
      const req = store.getAll();
      req.onsuccess = () => {
        let list = req.result || [];
        list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (filter !== 'All') {
          list = list.filter((r) => r.result.toLowerCase() === filter.toLowerCase());
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getUnsentRecords(limit = 50) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('auditLog', 'readonly');
      const store = tx.objectStore('auditLog');
      const index = store.index('uploaded');
      const req = index.getAll(IDBKeyRange.only(false));
      req.onsuccess = () => {
        const list = (req.result || []).slice(0, limit);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async markAsUploaded(ids) {
    if (!ids || ids.length === 0) return;
    return runTransaction('auditLog', 'readwrite', (tx) => {
      const store = tx.objectStore('auditLog');
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            req.result.uploaded = true;
            store.put(req.result);
          }
        };
      }
    });
  }
};

// ---------------- Issuance Queue API (Offline Queue) ---------------- //
export const queueStore = {
  async addPending(documentRecord) {
    const record = {
      ...documentRecord,
      createdAt: documentRecord.createdAt || new Date().toISOString(),
      status: 'Waiting to sync',
      retryCount: 0
    };
    return runTransaction('issuanceQueue', 'readwrite', (tx) => {
      const store = tx.objectStore('issuanceQueue');
      store.put(record);
    });
  },

  async getAllPending() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('issuanceQueue', 'readonly');
      const store = tx.objectStore('issuanceQueue');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async removePending(docId) {
    return runTransaction('issuanceQueue', 'readwrite', (tx) => {
      const store = tx.objectStore('issuanceQueue');
      store.delete(docId);
    });
  }
};

// ---------------- Meta Store API (Sync state) ---------------- //
export const metaStore = {
  async get(key, defaultValue = null) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => reject(req.error);
    });
  },

  async set(key, value) {
    return runTransaction('meta', 'readwrite', (tx) => {
      const store = tx.objectStore('meta');
      store.put({ key, value, updatedAt: new Date().toISOString() });
    });
  }
};

// ---------------- Initial Seed Data ---------------- //
// Pre-populates default cryptographic keys and revocation list for immediate offline use
export async function seedInitialRegistryData() {
  const initialized = await metaStore.get('registry_initialized');
  if (initialized) return;

  // Master ES256 Public Key (P-256) used for standard Ethiopian credentials
  const defaultKey = {
    kid: 'wase-aa-2026-01',
    createdDate: '2026-01-01',
    status: 'Active',
    description: 'Addis Ababa Public Registry Authority ES256 Key 2026',
    jwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'w9yhsGuXcfMi8icPCbYf5GThbSMHaNBn2V5dld-5qXg',
      y: 'HJGsXkTld80puDNwogERg3Wy_USI9B9KQddoFKlll7c',
      kid: 'wase-aa-2026-01',
      use: 'sig',
      alg: 'ES256'
    }
  };

  const regionalKey = {
    kid: 'wase-or-2026-01',
    createdDate: '2026-02-15',
    status: 'Active',
    description: 'Oromia Regional Cooperative Authority ES256 Key 2026',
    jwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'e72NI2C1wElS4uT-K4_q6v1iY_7lT6z3uV2xK4_q6v1',
      y: 'w83OJ3D2xFmT5vU-L5_r7w2jZ_8mU7a4vW3yL5_r7w0'
    }
  };

  await keyStore.putKeysBatch([defaultKey, regionalKey]);

  // Seed sample revoked doc
  await drlStore.revokeDocument('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'Reported lost by holder', 42);

  // Set default versions
  await metaStore.set('drl_version', 42);
  await metaStore.set('key_bundle_version', 1);
  await metaStore.set('last_sync_timestamp', new Date().toISOString());
  await metaStore.set('registry_initialized', true);
}
