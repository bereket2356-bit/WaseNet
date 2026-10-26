/**
 * Test: QR Generation with qrcode-generator and Multi-Stage jsQR Decoding Roundtrip
 *
 * Requirements:
 * - Generate QR for a known payload using qrcode-generator pinned version.
 * - Error correction level M, minimum 4 modules quiet zone.
 * - Render at >= 240px.
 * - Decode with jsQR (the same decoder the Verify page uses).
 * - Confirm the decoded text equals the original payload.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load jsQR using the UMD bundle
const jsqrPath = path.join(__dirname, '../frontend/public/lib/jsqr.js');
const jsqrCode = fs.readFileSync(jsqrPath, 'utf8');
const jsqrModule = {};
new Function('exports', 'module', jsqrCode)({}, jsqrModule);
const jsQR = jsqrModule.exports;

// Load qrcode-generator from cdnjs or local fetch
const QRCODE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

async function getQrCodeLibrary() {
  const res = await fetch(QRCODE_URL);
  if (!res.ok) throw new Error(`Failed to fetch qrcode-generator: ${res.status}`);
  const code = await res.text();
  const qm = { exports: {} };
  new Function('module', 'exports', code)(qm, qm.exports);
  return qm.exports;
}

// 4-step decoding pipeline matching Verify page
function multiStepDecode(imageData, w, h) {
  // 1. Full frame
  let code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return code.data;

  // 2. Centered crop (central 70%)
  const cw = Math.max(1, Math.round(w * 0.7));
  const ch = Math.max(1, Math.round(h * 0.7));
  const cx = Math.max(0, Math.round((w - cw) / 2));
  const cy = Math.max(0, Math.round((h - ch) / 2));
  const cropBuf = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const srcIdx = ((cy + y) * w + (cx + x)) * 4;
      const dstIdx = (y * cw + x) * 4;
      cropBuf[dstIdx] = imageData.data[srcIdx];
      cropBuf[dstIdx + 1] = imageData.data[srcIdx + 1];
      cropBuf[dstIdx + 2] = imageData.data[srcIdx + 2];
      cropBuf[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }
  code = jsQR(cropBuf, cw, ch, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return code.data;

  // 3. Downscaled copy
  if (w > 600 || h > 600) {
    const dw = Math.floor(w / 2);
    const dh = Math.floor(h / 2);
    const downBuf = new Uint8ClampedArray(dw * dh * 4);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const srcIdx = (y * 2 * w + x * 2) * 4;
        const dstIdx = (y * dw + x) * 4;
        downBuf[dstIdx] = imageData.data[srcIdx];
        downBuf[dstIdx + 1] = imageData.data[srcIdx + 1];
        downBuf[dstIdx + 2] = imageData.data[srcIdx + 2];
        downBuf[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
    code = jsQR(downBuf, dw, dh, { inversionAttempts: 'dontInvert' });
    if (code && code.data) return code.data;
  }

  // 4. Inverted copy
  const invBuf = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < invBuf.length; i += 4) {
    invBuf[i] = 255 - invBuf[i];
    invBuf[i + 1] = 255 - invBuf[i + 1];
    invBuf[i + 2] = 255 - invBuf[i + 2];
  }
  code = jsQR(invBuf, w, h, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return code.data;

  return null;
}

function renderQrToRgba(qr, minPixels = 240, margin = 4) {
  const moduleCount = qr.getModuleCount();
  const total = moduleCount + margin * 2;
  const scale = Math.max(2, Math.ceil(minPixels / total));
  const width = total * scale;
  const height = width;
  const data = new Uint8ClampedArray(width * height * 4);

  // Pure white background (including quiet zone)
  data.fill(255);

  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (qr.isDark(r, c)) {
        const startX = (c + margin) * scale;
        const startY = (r + margin) * scale;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const idx = ((startY + y) * width + (startX + x)) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  return { data, width, height };
}

async function run() {
  console.log('Testing qrcode-generator generation & jsQR decode roundtrip...');
  const qrcode = await getQrCodeLibrary();

  const testPayloads = [
    {
      name: 'Standard Ethiopian Land Certificate JWS',
      payload: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSIsInR5cCI6IkpXVCJ9.eyJkb2NfaWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDEiLCJkb2NfdHlwZSI6ImxhbmRfY2VydGlmaWNhdGUiLCJob2xkZXJfbmFtZSI6IkFiZWJlIEJpa2lsYSJ9.SIG_TEST_SAMPLE_12345'
    },
    {
      name: 'Cooperative Credential JWS',
      payload: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSIsInR5cCI6IkpXVCJ9.eyJkb2NfaWQiOiI3NzBhMTEyMi1jMzFhLTQyZDQtYjkxMi0xMTIyMzM0NDAwMDIiLCJkb2NfdHlwZSI6ImNvb3BlcmF0aXZlX2NyZWRlbnRpYWwiLCJob2xkZXJfbmFtZSI6IkNoYWxhIERlamVuZSJ9.SIG_COOP_45678'
    },
    {
      name: 'Birth Record JWS',
      payload: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSIsInR5cCI6IkpXVCJ9.eyJkb2NfaWQiOiI4ODFiMjIzMy1kNDJiLTQzZTUtYzgyMy0yMjMzNDQ1NTAwMDMiLCJkb2NfdHlwZSI6ImJpcnRoX3JlY29yZCIsImhvbGRlcl9uYW1lIjoiQWxtYXogS2ViZWRlIn0.SIG_BIRTH_99001'
    }
  ];

  for (const item of testPayloads) {
    // 1. Generate QR code with Level M and quiet zone >= 4 modules
    const qr = qrcode(0, 'M');
    qr.addData(item.payload);
    qr.make();

    // 2. Render to pixel buffer at >= 240px
    const imgData = renderQrToRgba(qr, 240, 4);
    assert.ok(imgData.width >= 240, `Rendered width must be >= 240px (was ${imgData.width}px)`);

    // 3. Decode with multiStepDecode (using jsQR)
    const decoded = multiStepDecode(imgData, imgData.width, imgData.height);

    // 4. Confirm decoded text equals original payload
    assert.equal(decoded, item.payload, `Decoded text must match original payload for ${item.name}`);
    console.log(`  ✓ PASS: ${item.name} (${imgData.width}x${imgData.height}px, Level M, quiet zone >= 4 modules)`);
  }

  console.log('\nAll QR roundtrip tests passed successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
