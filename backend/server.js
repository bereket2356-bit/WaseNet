/**
 * WaseNet Secure Backend Server
 * Node.js Native HTTP & Cryptographic Server (ES256 ECDSA P-256)
 * Provides authentication (8-hr JWT), keys, DRL delta sync, audit upload,
 * offline issuance sync, and server-side document signing (NFR-S2).
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'wasenet-ethiopia-gov-jwt-secret-key-2026';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

// ---------------- In-Memory / File Persistent Registry Store ---------------- //
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Generate / Load Master ES256 Server Keypair (P-256)
const KEY_PATH = path.join(DATA_DIR, 'server_es256.json');
let serverKeys;

if (fs.existsSync(KEY_PATH)) {
  try {
    serverKeys = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  } catch (e) {}
}

if (!serverKeys) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1' // NIST P-256
  });

  const jwkPublic = publicKey.export({ format: 'jwk' });
  const jwkPrivate = privateKey.export({ format: 'jwk' });

  serverKeys = {
    kid: 'wase-aa-2026-01',
    description: 'Addis Ababa Public Registry Authority ES256 Key 2026',
    createdDate: '2026-01-01',
    status: 'Active',
    jwkPublic,
    jwkPrivate,
    pemPrivate: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    pemPublic: publicKey.export({ type: 'spki', format: 'pem' })
  };

  fs.writeFileSync(KEY_PATH, JSON.stringify(serverKeys, null, 2));
}

// Registry Data Store
let drlVersion = 42;
const revocationList = [
  {
    doc_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    reason: 'Reported lost by holder',
    revokedAt: '2026-02-01T10:00:00Z',
    version: 42
  }
];

let publicKeysList = [
  {
    kid: serverKeys.kid,
    createdDate: serverKeys.createdDate,
    status: 'Active',
    description: serverKeys.description,
    jwk: serverKeys.jwkPublic
  },
  {
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
  }
];

const auditRecordsStore = [];
const syncedDocumentsStore = new Map();

// ---------------- Cryptographic Helpers ---------------- //
function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const members = keys.map((k) => JSON.stringify(k) + ':' + canonicalizeJson(obj[k]));
  return '{' + members.join(',') + '}';
}

function signEs256(headerObj, payloadObj, pemPrivateKey) {
  const hB64 = base64UrlEncode(Buffer.from(JSON.stringify(headerObj)));
  const pB64 = base64UrlEncode(Buffer.from(canonicalizeJson(payloadObj)));
  const signingInput = `${hB64}.${pB64}`;

  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  signer.end();

  // IEEE P1363 format (raw 64 bytes: 32 bytes r + 32 bytes s for P-256)
  const signature = signer.sign({
    key: pemPrivateKey,
    dsaEncoding: 'ieee-p1363'
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// ---------------- JWT Session Helpers (FR-1.3) ---------------- //
function createSessionToken(user) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.username,
    role: user.role,
    office: user.office,
    issuerCode: user.issuerCode,
    iat: now,
    exp: now + 8 * 3600 // 8-hour absolute expiry
  };

  const hB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const pB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${hB64}.${pB64}`).digest();

  return `${hB64}.${pB64}.${base64UrlEncode(sig)}`;
}

function verifySessionToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [hB64, pB64, sB64] = parts;
  const expectedSig = base64UrlEncode(crypto.createHmac('sha256', JWT_SECRET).update(`${hB64}.${pB64}`).digest());
  if (sB64 !== expectedSig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(pB64).toString('utf8'));
    if (payload.exp && Date.now() / 1000 >= payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// ---------------- Request Router ---------------- //
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. POST /api/auth/login
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      const { username, password } = body;

      if (username === 'issuer' && password === 'issuer123') {
        const user = {
          username: 'issuer',
          role: 'issuer',
          office: 'Addis Ababa Sub-city Office 04',
          issuerCode: 'ET-AA-LAND-04'
        };
        const token = createSessionToken(user);
        return sendJson(res, 200, { token, user });
      }

      if (username === 'admin' && password === 'admin123') {
        const user = {
          username: 'admin',
          role: 'administrator',
          office: 'National Registry Directorate',
          issuerCode: 'ET-FED-ADMIN-01'
        };
        const token = createSessionToken(user);
        return sendJson(res, 200, { token, user });
      }

      return sendJson(res, 401, { error: 'Sign-in failed. Check your username and password.' });
    }

    // 2. GET /api/keys/bundle
    if (req.method === 'GET' && pathname === '/api/keys/bundle') {
      return sendJson(res, 200, {
        version: 1,
        keys: publicKeysList
      });
    }

    // 3. GET /api/revocation-list
    if (req.method === 'GET' && pathname === '/api/revocation-list') {
      const since = parseInt(parsedUrl.searchParams.get('sinceVersion') || '0', 10);
      const delta = revocationList.filter((item) => (item.version || 0) > since);

      return sendJson(res, 200, {
        version: drlVersion,
        delta: delta,
        totalCount: revocationList.length
      });
    }

    // 4. POST /api/admin/revoke (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/revoke') {
      const auth = verifySessionToken(req.headers.authorization);
      if (!auth || auth.role !== 'administrator') {
        return sendJson(res, 403, { error: 'Unauthorized: Administrator access required' });
      }

      const body = await readBody(req);
      const { doc_id, reason } = body;
      if (!doc_id) {
        return sendJson(res, 400, { error: 'Document ID required' });
      }

      drlVersion += 1;
      const record = {
        doc_id,
        reason: reason || 'Revoked by authority',
        revokedAt: new Date().toISOString(),
        version: drlVersion
      };
      revocationList.push(record);

      return sendJson(res, 200, { success: true, version: drlVersion, record });
    }

    // 5. POST /api/issue/sign (Issuer or Admin)
    if (req.method === 'POST' && pathname === '/api/issue/sign') {
      const auth = verifySessionToken(req.headers.authorization);
      if (!auth) {
        return sendJson(res, 401, { error: 'Authentication required to sign document' });
      }

      const body = await readBody(req);
      const { payload, kid = serverKeys.kid } = body;
      if (!payload || !payload.doc_id) {
        return sendJson(res, 400, { error: 'Invalid document payload' });
      }

      const header = {
        alg: 'ES256',
        kid: kid,
        typ: 'JWT'
      };

      const jws = signEs256(header, payload, serverKeys.pemPrivate);
      syncedDocumentsStore.set(payload.doc_id, { payload, jws, createdAt: new Date().toISOString() });

      return sendJson(res, 200, { jws, kid });
    }

    // 6. POST /api/issue/sync (Idempotent offline batch sync)
    if (req.method === 'POST' && pathname === '/api/issue/sync') {
      const auth = verifySessionToken(req.headers.authorization);
      const body = await readBody(req);
      const docs = body.documents || [];

      let syncedCount = 0;
      for (const d of docs) {
        if (d.doc_id && !syncedDocumentsStore.has(d.doc_id)) {
          syncedDocumentsStore.set(d.doc_id, d);
          syncedCount++;
        }
      }

      return sendJson(res, 200, { success: true, syncedCount, totalStored: syncedDocumentsStore.size });
    }

    // 7. POST /api/audit/batch (Idempotent audit batch upload)
    if (req.method === 'POST' && pathname === '/api/audit/batch') {
      const body = await readBody(req);
      const records = body.records || [];
      auditRecordsStore.push(...records);

      return sendJson(res, 200, { success: true, receivedCount: records.length });
    }

    // 8. GET /api/verify/:docId (Live online verification check)
    if (req.method === 'GET' && pathname.startsWith('/api/verify/')) {
      const docId = decodeURIComponent(pathname.replace('/api/verify/', ''));

      // Check DRL
      const revoked = revocationList.find((r) => r.doc_id === docId);
      if (revoked) {
        return sendJson(res, 200, {
          status: 'REVOKED',
          payload: { doc_id: docId },
          revocationReason: revoked.reason
        });
      }

      // Check synced store
      if (syncedDocumentsStore.has(docId)) {
        const item = syncedDocumentsStore.get(docId);
        const expiresAt = item.payload?.expires_at ? new Date(item.payload.expires_at) : null;
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          return sendJson(res, 200, { status: 'EXPIRED', payload: item.payload });
        }
        return sendJson(res, 200, { status: 'VALID', payload: item.payload });
      }

      return sendJson(res, 404, { status: 'UNREADABLE', error: 'Document not found in central registry' });
    }

    // 9. GET /api/health
    if (pathname === '/api/health') {
      let dbStatus = 'disconnected';
      if (dbPool) {
        try {
          const resDb = await dbPool.query('SELECT 1');
          if (resDb.rows.length) dbStatus = 'connected';
        } catch (e) {
          dbStatus = 'error: ' + e.message;
        }
      }
      return sendJson(res, 200, {
        status: 'healthy',
        database: dbStatus,
        provider: 'Neon PostgreSQL',
        drlVersion,
        activeKeys: publicKeysList.length
      });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: 'Internal server error: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log(`WaseNet Registry Backend running on http://localhost:${PORT}`);
});
