# WaseNet - Hybrid Document Authentication System
An offline-first platform for issuing and verifying public-sector documents in Ethiopia. Authorized offices issue digitally signed credentials as QR codes, and anyone can verify them in the field, even with no network connection. The verifier is a Progressive Web App (PWA), and the issuing side is a secure admin backend that manages signing keys and revocations.

### 💻 Developer
**Bereket Teshome** (CTC-1367-26)
* **Role:** Solo Developer, covering the PWA verifier, issuance web app, FastAPI backend, and PostgreSQL/SQLite database design.

### 📚 Project Resources
* **Project Documentation:** [View Project Report](https://drive.google.com/file/d/1fx7frr4wQs8AqHd75xm4nnxpvbptYtWN/view?usp=drive_link)
* **Video Demonstration:** [Watch Demo](https://link-to-your-demo)

### 🌐 Live Site
* **Demo:** [https://wase-net.vercel.app](https://wase-net.vercel.app)

---

## ✨ Features
* **Credential issuance:** Form-based metadata entry, SHA-256 hashing, ECDSA P-256 signing (JWS format), and Level M QR code generation.
* **Offline verification:** Camera-based QR scanning with local signature checks using the Web Crypto API.
* **Clear results:** Each scan shows `VALID`, `TAMPERED/INVALID`, `REVOKED`, or `EXPIRED`.
* **Trust sync:** Public keys and the revocation list download automatically when the device is online.
* **Admin panel:** Manage signing keys, key status, and document revocations.
* **Audit logs:** Verification events are stored locally and uploaded when the device reconnects.
* **Bilingual interface:** English and Amharic.

## 🛠️ Tech Stack
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript, Service Workers |
| Offline storage | IndexedDB |
| Cryptography | Web Crypto API (client), Python `cryptography` (server) |
| Backend | Python, FastAPI |
| Database | SQLite (development), PostgreSQL (production) |

## 📖 Usage
1. **Issue a credential:** Sign in to the admin dashboard, fill in the document details, and generate the QR code.
2. **Verify a credential:** Open the verifier app, turn on Airplane Mode, scan the QR code, and read the result banner.

## 🔒 Security
* Private signing keys stay on the server and are never sent to client devices.
* All traffic uses HTTPS with TLS 1.3.
* Passwords are hashed with Bcrypt or Argon2.
* Admin sessions expire after 8 hours.
* Each credential has a unique UUIDv4 ID and an issuance timestamp to prevent replay.
* No biometric data is collected or stored.

## ⚠️ Limitations
* Keys are stored in software, not in a hardware security module.
* There is no integration with the national PKI or Fayda ID system yet.
* The verifier targets Android and Chromium-based browsers. There is no native iOS app.

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
