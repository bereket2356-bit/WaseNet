# WaseNet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1-blue.svg)](CHANGELOG.md)

**Author:** Bereket Teshome (ID: `CTC-1367-26`)

**Offline-first document authentication for public-sector credentials.**

WaseNet lets authorized institutions issue digitally signed credentials as QR codes, and lets anyone verify them in the field without a network connection.

---

## Overview

Many public-sector offices in Ethiopia, such as land registries, cooperatives, vital statistics offices, and local administration units, issue paper documents that are easy to forge. Verifying them usually means calling the issuing office, which is slow, and often impossible in rural areas with poor connectivity.

WaseNet addresses this by embedding a cryptographic signature in a QR code printed on each document. The issuing server signs the document data with a private key. A verifier scans the code with a phone, and the app checks the signature against a public key stored on the device. The check works offline.

The verifier app is a Progressive Web App (PWA). It syncs trusted public keys and the Document Revocation List (DRL) whenever it has a connection, so it can operate for extended periods without one.

WaseNet is an MVP developed as part of the INSA Phase-Two capstone project.

---

## Key Features

- **Credential issuance.** A web form captures document metadata. The data is canonicalized, hashed with SHA-256, signed with ECDSA P-256 (or RSA-2048), and rendered as a Level M QR code.
- **Offline verification.** The PWA scans QR codes with the device camera and verifies signatures locally using `crypto.subtle.verify`.
- **Clear verification results.** Each scan returns one of four states: `VALID`, `TAMPERED/INVALID`, `REVOKED`, or `EXPIRED`.
- **Trust synchronization.** When online, the app downloads the public key bundle and delta updates to the revocation list.
- **Admin panel.** Administrators manage signing keys, key status, and document revocations with standardized reason codes.
- **Audit logging.** Every verification is logged locally and uploaded in batches when connectivity returns.
- **Offline issuance queue.** Issuers can queue credentials while offline. They sync automatically once the connection is restored.
- **Bilingual interface.** English and Amharic, switchable at runtime.

---

## How It Works

### Issuance

1. An authorized official enters document details in the issuance form.
2. The server converts the data into a deterministic JSON string and computes its SHA-256 hash.
3. The server signs the hash with the issuer's private key.
4. The header, payload, and signature are combined into a JWS Compact Serialization string:

   ```text
   [Header].[Payload].[Signature]
   ```

5. The string is rendered as a QR code and printed on the document.

### Verification

1. The verifier opens the app and scans the QR code.
2. The app reads the `key_id` from the JWS header and looks up the matching public key in IndexedDB.
3. The app verifies the signature locally against the payload.
4. The app checks the document ID against the local revocation list and compares the expiry date with the current time.
5. The app shows one result:

| Result | Meaning |
|---|---|
| `VALID` | Signature is authentic, the document is not revoked, and it has not expired. |
| `TAMPERED/INVALID` | The signature does not match the payload. The document may be forged or altered. |
| `REVOKED` | The signature is authentic, but the document appears on the revocation list. |
| `EXPIRED` | The signature is authentic, but the document is past its expiry date. |

6. The result is logged locally and queued for upload.

---

## Architecture

```text
 ONLINE                                          
 ┌──────────────────┐   HTTPS   ┌────────────────┐   ┌────────────────┐
 │  Issuer Web App  │ ────────► │  Backend API   │ ─►│   Database     │
 │  (admin, issue)  │           │ (FastAPI)      │   │ (PostgreSQL /  │
 └──────────────────┘           └───────┬────────┘   │    SQLite)     │
                                        │            └────────────────┘
 ───────────────────────────────────────┼─────────────────────────────────
 OFFLINE BOUNDARY                       │  Sync when online:
                                        │  - Public key bundle
                                        │  - DRL delta updates
                                        │  - Audit log batches
 ───────────────────────────────────────┼─────────────────────────────────
 OFFLINE                                ▼                                  
 ┌───────────────────────────────────────────────────────────────────────┐
 │  Verifier PWA (mobile browser)                                        │
 │                                                                       │
 │  Camera scanner ─► Web Crypto API ◄─► IndexedDB                       │
 │                                       - Public key bundle             │
 │                                       - Revocation list               │
 │                                       - Audit log queue               │
 │                                       - Issuance queue                │
 └───────────────────────────────────────────────────────────────────────┘
```

Verification never leaves the device. The backend is needed only for issuance, administration, and synchronization.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Client | HTML5, CSS3, vanilla JavaScript |
| Offline support | Service Workers, IndexedDB |
| Cryptography | Web Crypto API (client), Python `cryptography` library (server) |
| Backend | Python 3.10+, FastAPI |
| Database | SQLite (development), PostgreSQL 14+ (production) |
| Transport | HTTPS with TLS 1.3 |

---

## Project Structure

```text
wasenet/
├── client/                    # Verifier PWA
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── css/
│   └── js/
│       ├── app.js             # UI controller and navigation
│       ├── crypto.js          # Signature verification
│       ├── db.js              # IndexedDB access layer
│       ├── qr-scanner.js      # Camera and QR decoding
│       └── i18n.js            # English and Amharic strings
├── server/                    # Backend API
│   ├── app/
│   │   ├── api/               # Route handlers (auth, credentials, sync)
│   │   ├── core/              # Cryptography and configuration
│   │   ├── models/            # Database models
│   │   └── services/          # Issuance and revocation logic
│   ├── keys/                  # Private signing keys (gitignored)
│   ├── migrations/            # Database migrations
│   └── requirements.txt
├── scripts/
│   └── generate_keys.py       # Key pair generator
├── docs/                      # Architecture and threat model
├── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

> **Note:** Private keys must never be committed to version control or shipped to client devices. The `server/keys/` directory is excluded by `.gitignore`. Only public key bundles are distributed to the PWA.

---

## Getting Started

### Prerequisites

- Python 3.10 or later
- PostgreSQL 14+ (optional; SQLite is used by default in development)
- OpenSSL
- A modern browser with camera access (Chrome, Chromium, or Firefox)

### Installation

1. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/bereket2356-bit/wasenet.git
   cd wasenet
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and set at least `JWT_SECRET` and `DATABASE_URL`. See [Configuration](#configuration).

3. Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate        # On Windows: .\venv\Scripts\activate
   pip install -r server/requirements.txt
   ```

4. Apply database migrations:

   ```bash
   alembic -c server/alembic.ini upgrade head
   ```

5. Generate a signing key pair:

   ```bash
   python scripts/generate_keys.py --alg ES256 --out-dir ./server/keys/
   ```

   This creates a private key, which stays on the server, and a public key, which is added to the trust bundle.

6. Start the server:

   ```bash
   uvicorn server.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

### Running the PWA Locally

Browsers only allow camera access and Service Workers in a secure context. `localhost` counts as secure, so the app works on your own machine without extra setup.

To test on a physical Android device over your local network, serve the app over HTTPS. For example, using a local certificate:

```bash
npx local-ssl-proxy --source 8443 --target 8000 --cert cert.pem --key key.pem
```

Then open `https://<your-machine-ip>:8443` on the device.

---

## Usage

### Issuing a Credential

1. Open the issuer dashboard at `https://localhost:8443/issuer` (or your configured host).
2. Sign in with an issuer account.
3. Fill in the document details: document type, holder name, holder ID, issuer code, issue date, and expiry date.
4. Select **Issue Credential**.
   - When online, the server signs the credential and returns the QR code.
   - When offline, the credential is stored in the issuance queue and signed once the connection returns.
5. Print or download the QR code and attach it to the document.

### Verifying a Credential Offline

1. Open the verifier app on a device that has completed at least one sync while online.
2. Turn on Airplane Mode to confirm that verification works without a connection.
3. Select **Scan** and point the camera at the QR code.
4. Read the result banner:
   - Green: `VALID`
   - Red: `TAMPERED/INVALID` or `REVOKED`
   - Orange: `EXPIRED`

---

## Configuration

Set these variables in your `.env` file:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./wasenet.db` | Database connection string |
| `JWT_SECRET` | none (required) | Secret used to sign admin session tokens |
| `JWT_EXPIRY_HOURS` | `8` | Admin session lifetime in hours |
| `SIGNING_ALGORITHM` | `ES256` | Signing algorithm: `ES256` or `RS256` |
| `DRL_SYNC_INTERVAL` | `3600` | Seconds between revocation list checks |
| `DEFAULT_LANGUAGE` | `en` | Default interface language: `en` or `am` |

---

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Sign in and receive an 8-hour session token |
| `POST` | `/api/credentials` | Create and sign a credential |
| `GET` | `/api/keys/bundle` | Download the active public key bundle |
| `GET` | `/api/revocations?since=<version>` | Fetch revocation list updates since a given version |
| `POST` | `/api/revocations` | Revoke a document with a reason code |
| `POST` | `/api/audit/batch` | Upload a batch of verification audit events |

---

## Security

- **Private keys stay on the server.** Signing keys are never sent to client devices or stored in the browser.
- **Encrypted transport.** All client-server traffic uses HTTPS with TLS 1.3.
- **Password hashing.** Account passwords are hashed with Bcrypt or Argon2.
- **Short sessions.** Admin tokens expire after 8 hours.
- **Replay resistance.** Each credential includes a unique UUIDv4 document ID and an issuance timestamp.
- **Data minimization.** Only the metadata needed for verification is stored. No biometric data is collected.

---

## Limitations

- **No hardware security module.** Keys are stored in software in this version.
- **No national PKI or Fayda integration.** Verification relies on internal trust bundles.
- **No blockchain.** Revocation uses compact, delta-synced lists.
- **Android-first.** The verifier targets Android browsers and Chromium-based desktop browsers. There is no native iOS app.

---

## Roadmap

**Phase 2 (current)**
- [ ] Audit log batch synchronization
- [ ] Amharic typography and translation review

**Future**
- [ ] Printable PDF credentials with watermarked QR codes
- [ ] Expiry alerts for issuers
- [ ] HSM support via PKCS#11
- [ ] Adapter for Fayda national ID verification

---

## Contributing

1. Fork the repository and create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

2. Follow the project's linting and formatting rules.
3. Add tests that cover both online and offline verification.
4. Make sure all tests pass.
5. Open a pull request with a short description of your changes.

---

## License

WaseNet is released under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgements

- Information Network Security Administration (INSA), for the Phase-Two capstone framework and guidance.
- Capstone supervisors and advisors.
