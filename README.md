# WaseNet — Hybrid Online/Offline Document Authentication System

WaseNet is a hybrid online/offline document authentication system built for public registries in Ethiopia (land administration certificates, cooperative credentials, vital statistics, and local commercial permits). It enables instant cryptographic validation on entry-level Android smartphones over 2G/3G connections and continues operating completely offline once loaded.

---

## Deliverables & Architecture Overview

### 1. Project File Tree

```
WaseNet/
├── frontend/
│   ├── public/
│   │   ├── icons/
│   │   │   ├── icon.svg                     # High-res official emblem SVG
│   │   │   ├── icon-192.png                 # PWA standard app icon
│   │   │   └── icon-512.png                 # PWA splash/install icon
│   │   ├── lib/
│   │   │   └── jsqr.js                      # Pinned pure JS QR decoder (100% offline)
│   │   ├── manifest.webmanifest             # Progressive Web App manifest
│   │   └── sw.js                            # Service Worker (App shell caching)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx                   # Official registry header, sync bar, lang switcher
│   │   │   └── Footer.jsx                   # Archival registry footer
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx              # Page 1: Public front door (/)
│   │   │   ├── VerifyPage.jsx               # Page 2: Camera & manual verification (/verify)
│   │   │   ├── ResultPage.jsx               # Page 3: 4-state result banner & details (/verify/result)
│   │   │   ├── LoginPage.jsx                # Page 4: 8-hr JWT sign-in (/login)
│   │   │   ├── IssuePage.jsx                # Page 5: Deterministic credential creation (/issue)
│   │   │   ├── IssueDonePage.jsx            # Page 6: Level M QR & print/save (/issue/done)
│   │   │   ├── QueuePage.jsx                # Page 7: Offline issuance queue (/queue)
│   │   │   ├── AuditPage.jsx                # Page 8: Device verification audit log (/audit)
│   │   │   ├── AdminKeysPage.jsx            # Page 9: Public keys management (/admin/keys)
│   │   │   ├── AdminRevokePage.jsx          # Page 10: Revoke a document & DRL (/admin/revoke)
│   │   │   ├── AdminIssuersPage.jsx         # Page 11: Issuing offices directory (/admin/issuers)
│   │   │   ├── SyncPage.jsx                 # Page 12: Registry sync status & trigger (/sync)
│   │   │   └── TestPage.jsx                 # Interactive in-browser unit test runner (/test)
│   │   ├── crypto.js                        # Canonical JSON (RFC 8785), SHA-256, ES256 JWS
│   │   ├── storage.js                       # IndexedDB transaction-safe stores
│   │   ├── signing-provider.js              # Decoupled SigningProvider interface
│   │   ├── auth.js                          # 8-hr JWT session, RBAC, unsaved form preservation
│   │   ├── sync.js                          # Sync engine with exponential backoff
│   │   ├── qr-generator.js                  # Standalone pure JS Level M QR code generator
│   │   ├── sample-docs.js                   # Seed certificates (Valid, Tampered, Revoked, Expired)
│   │   ├── i18n.jsx                         # English & Amharic reactive context hook
│   │   ├── i18n-dictionary.js               # Complete English & Amharic localized dictionary
│   │   ├── index.css                        # Visual system (Newsreader, Atkinson Hyperlegible, palette)
│   │   ├── App.jsx                          # Router container & navigation state
│   │   └── main.jsx                         # React entry point
│   ├── index.html                           # Vite entry HTML
│   ├── package.json                         # React 19 & Vite 8
│   └── vite.config.js                       # Development proxy to backend
├── backend/
│   ├── data/
│   │   └── server_es256.json                # Server-held ECDSA P-256 keypair
│   ├── server.js                            # Native Node.js REST API & ES256 signing service
│   └── package.json
├── tests/
│   ├── crypto.test.js                       # Node unit test: Canonicalization, SHA-256, JWS
│   └── verify-logic.test.js                 # Node unit test: 4-state logic & tamper rules
└── README.md
```

---

## 2. Local Run Instructions

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm

### Step 1: Start Backend API Server
In a terminal, navigate to the `backend` directory and run:
```bash
cd backend
npm start
```
The server starts at `http://localhost:5000`. It initializes an ECDSA P-256 keypair and serves:
- Authentication (`/api/auth/login`) with 8-hour JWT sessions
- Public Key Certificate Bundle (`/api/keys/bundle`)
- Document Revocation List delta sync (`/api/revocation-list`)
- Server-side ES256 Signing (`/api/issue/sign`)
- Idempotent offline queue sync (`/api/issue/sync`)
- Idempotent audit batch upload (`/api/audit/batch`)
- Live document verification (`/api/verify/:id`)

### Step 2: Start Frontend Development Server
In another terminal, navigate to the `frontend` directory and run:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

### Demo User Accounts
- **Issuing Officer**: `issuer` / `issuer123` (Access to Issue, Queue, Audit)
- **Administrator**: `admin` / `admin123` (Access to Issue, Queue, Audit, Keys, Revoke, Issuers, Sync)

---

## 3. Serving over HTTPS for Camera Access

Browsers require a **Secure Context (HTTPS or localhost)** to allow access to `navigator.mediaDevices.getUserMedia`. When accessing WaseNet from an Android phone or another device across the local network:

### Option A: Localhost Tunneling (Recommended for Field Devices)
Use a secure tunnel such as Cloudflare Tunnel or localtunnel:
```bash
npx localtunnel --port 5173
```
Open the generated `https://*.loca.lt` URL on the Android phone.

### Option B: Vite HTTPS Dev Server
Install the Vite basic SSL plugin:
```bash
cd frontend
npm install @vitejs/plugin-basic-ssl --save-dev
```
Add `basicSsl()` to `vite.config.js`:
```javascript
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }
  }
});
```
Then run `npm run dev -- --host` and access `https://<YOUR_IP>:5173`. Accept the self-signed certificate warning on your mobile device.

---

## 4. How to Test Offline Mode

1. Open `http://localhost:5173` in Google Chrome or Android Chrome.
2. Allow the app to load once. The Service Worker (`sw.js`) caches the app shell, stylesheets, web fonts, and the pinned offline QR decoder (`jsqr.js`).
3. Open Chrome DevTools (`F12`), switch to the **Network** tab, and select **Offline** (or enable Airplane Mode on a mobile device).
4. Verify core functionality while offline:
   - **Verify a document**: Click "Scan a document" -> test sample certificates. Verification succeeds completely offline because the cryptographic public keys and revocation list are cached in IndexedDB.
   - **Tamper detection**: Test the tampered certificate. It detects the invalid signature and rejects the document with details hidden.
   - **Issue a document**: Sign in and navigate to `/issue`. An offline banner appears: *"You're offline. This document will be saved and sent when you're back online."* Submitting saves the document in the offline `issuanceQueue` as "Waiting to sync".
   - **Automatic background sync**: Switch the network back to **Online**. The sync engine detects network reconnection and syncs the pending issuance queue and audit logs with exponential backoff.

---

## 5. How to Change the Signing Location

The system decouples the signing step behind a single interface (`ISigningProvider`) in [signing-provider.js](file:///d:/Projects/WaseNet/frontend/src/signing-provider.js):

```javascript
export class SigningProvider {
  async signDocument(documentPayload, kid, authToken) { ... }
}
```

### Option 1: Server-Side Signing (`ServerSigningProvider` — Default)
- Documents are canonicalized, hashed with SHA-256, and sent to `/api/issue/sign`.
- The server signs the credential using the protected ECDSA P-256 private key stored in `/backend/data/server_es256.json`.
- Private keys are **never** stored on verifier devices, verifier code, or browser storage (NFR-S2).

### Option 2: Isolated Hardware Token / Secure Enclave (`IsolatedMockHardwareSigningProvider`)
- For offline counter operations with an attached cryptographic USB token or Secure Enclave simulator.
- Private keys exist solely in transient memory during signing and are **never** written to IndexedDB or localStorage.
- To switch providers, call:
```javascript
import { setSigningProvider, IsolatedMockHardwareSigningProvider } from './signing-provider.js';
setSigningProvider(new IsolatedMockHardwareSigningProvider());
```

---

## 6. Cryptographic Specifications

- **Canonicalization**: RFC 8785 (JSON Canonicalization Scheme / JCS). Keys are recursively sorted lexicographically; no whitespace around separators.
- **Hashing**: SHA-256 of the UTF-8 canonical byte stream.
- **Digital Signature**: ES256 (ECDSA with NIST P-256 curve and SHA-256). Signatures use IEEE P1363 64-byte raw encoding (`r || s`).
- **JWS Header**: `{"alg":"ES256","kid":"wase-aa-2026-01","typ":"JWT"}`.
- **QR Code Matrix**: Standards-compliant QR Code with **Level M** error correction (15% damage recovery).

---

## 7. SRS Ambiguities Resolved

| # | Ambiguity / Underspecified Item | SRS Resolution & Architecture Choice |
|---|---|---|
| **1** | **Signing Location & Key Custody** | Decoupled behind `SigningProvider`. Default is `ServerSigningProvider` where private key remains strictly on the server (NFR-S2). For disconnected field counters, `IsolatedMockHardwareSigningProvider` holds ephemeral keys in memory without persistence. |
| **2** | **QR Code Payload Encoding** | Encoded as standard JWS Compact Serialization string (`header.payload.signature`). Defensively handles raw JWS strings, custom scheme prefixes (`wasenet:<jws>`), and URL fragment formats (`https://...#<jws>`). |
| **3** | **Check Precedence Order** | Strict 4-step sequence: (1) Cryptographic signature first; (2) DRL revocation second; (3) Expiry date third; (4) Valid. A tampered document **never** displays as valid, revoked, or expired. |
| **4** | **Tampered & Unreadable Data Privacy** | Document details (holder name, dates, ID) are strictly hidden for `TAMPERED` and `UNREADABLE` states to prevent fraudulent data display, accompanied by: *"Details are hidden because the signature did not match."* |
| **5** | **Offline Storage Ceiling (NFR-P3)** | Caches lightweight app shell, fonts, and IndexedDB delta records. Total storage footprint is < 3 MB, comfortably below the 25 MB limit. |
| **6** | **Session Expiry & Data Preservation** | 8-hour JWT absolute session expiry. When redirected from protected forms upon timeout, inputs are stored in `sessionStorage` and automatically restored when the officer logs back in. |
| **7** | **Idempotent Sync Mechanism** | Client tracks `drl_version` and `key_bundle_version`. Server responds with delta updates (`sinceVersion`), eliminating redundant downloads. Audit uploads and issuance queue syncs use document IDs as deduplication idempotency keys. |

---

## 8. Unit Test Execution

Run the automated Node.js test suite:
```bash
node --test tests/crypto.test.js tests/verify-logic.test.js
```

### Test Suite Output
```
✔ RFC 8785 Deterministic Canonical JSON stringification (1.07ms)
✔ Canonical JSON handles primitive and edge types (0.13ms)
✔ Base64URL encoding and decoding (RFC 7515 / RFC 4648) (0.41ms)
✔ SHA-256 calculation matches standard vector (5.63ms)
✔ JWS Compact Serialization produces valid 3-part token with ES256 (4.01ms)
▶ 4-State Verification Logic and Precedence Rules
  ✔ 1. Valid document verification (6.10ms)
  ✔ 2. Tampered content detection (signature mismatch) (1.46ms)
  ✔ 3. CRITICAL RULE: Tampered document must NEVER display as VALID, REVOKED, or EXPIRED (1.31ms)
  ✔ 4. Revoked document check (authentic signature but on DRL) (1.51ms)
  ✔ 5. Expired document check (authentic signature, not on DRL, but past date) (1.33ms)
  ✔ 6. Security: Rejection of algorithm "none" and other algorithms (0.26ms)
  ✔ 7. Security: Rejection of unknown or revoked kid (0.69ms)
  ✔ 8. Robustness: Malformed QR payload resolves to UNREADABLE without crash (0.72ms)
✔ 4-State Verification Logic and Precedence Rules (16.29ms)
ℹ tests 14 | pass 14 | fail 0
```

You can also run tests interactively in the browser by navigating to `#/test` in the running frontend.