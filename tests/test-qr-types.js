/**
 * Test: QR Code Generation & Multi-Stage Decoding for the Four Document Types
 * 
 * Verifies Requirement 6:
 * - Generates Level M QR code with at least 4 modules of quiet zone and >= 240px for each of the 4 document types:
 *   1. Land certificate
 *   2. Cooperative credential
 *   3. Birth record
 *   4. Local permit
 * - Implements the 4-stage decoder:
 *   1. Full frame
 *   2. Centered crop
 *   3. Downscaled copy
 *   4. Inverted copy
 * - Asserts decoded text equals original payload for all four types.
 */

import { createRequire } from 'module';
import assert from 'assert';

const require = createRequire(import.meta.url);
global.self = global;
require('../frontend/public/lib/jsqr.js');
const jsQR = global.jsQR;
const QRCode = require('../frontend/node_modules/qrcode');

// Four official document types with compact signed JWS payloads
const DOCUMENT_TYPES = [
  {
    type: 'Land certificate',
    jws: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSJ9.eyJkb2NfaWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDEiLCJ0eXBlIjoiTGFuZCBjZXJ0aWZpY2F0ZSIsImhvbGRlcl9uYW1lIjoiQWJlYmUgQmlraWxhIiwiaG9sZGVyX2lkIjoiMTAyNDU4OTIzNDAxNzY4NSIsImlzc3VlZF9hdCI6IjIwMjYtMTAtMDFUMDk6MDA6MDBaIiwiZXhwaXJlc19hdCI6IjIwMzEtMTAtMDFUMTc6MDA6MDBaIiwiaXNzdWVyX2NvZGUiOiJFVExBTkQwNCJ9.G_m129hZ59-4kH'
  },
  {
    type: 'Cooperative credential',
    jws: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSJ9.eyJkb2NfaWQiOiI3NzBhMTEyMi1jMzFhLTQyZDQtYjkxMi0xMTIyMzM0NDAwMDIiLCJ0eXBlIjoiQ29vcGVyYXRpdmUgY3JlZGVudGlhbCIsImhvbGRlcl9uYW1lIjoiQ2hhbGEgRGVqZW5lIiwiaG9sZGVyX2lkIjoiMjA0ODExOTQ4MjAzOTk0MSIsImlzc3VlZF9hdCI6IjIwMjYtMTAtMDVUMDk6MDA6MDBaIiwiZXhwaXJlc19hdCI6IjIwMjktMTAtMDVUMTc6MDA6MDBaIiwiaXNzdWVyX2NvZGUiOiJFVExBTkQwNCJ9.G_m129hZ59-4kH'
  },
  {
    type: 'Birth record',
    jws: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSJ9.eyJkb2NfaWQiOiI4ODFiMjIzMy1kNDJiLTQzZTUtYzgyMy0yMjMzNDQ1NTAwMDMiLCJ0eXBlIjoiQmlydGggcmVjb3JkIiwiaG9sZGVyX25hbWUiOiJBbG1heiBLZWJlZGUiLCJob2xkZXJfaWQiOiIzMDkyNDQxMDY3MjE1NTgyIiwiaXNzdWVkX2F0IjoiMjAyNi0xMC0xMFQwOTowMDowMFoiLCJleHBpcmVzX2F0IjoiMjAzNi0xMC0xMFQxNzowMDowMFoiLCJpc3N1ZXJfY29kZSI6IkVUTEFORDA0In0.G_m129hZ59-4kH'
  },
  {
    type: 'Local permit',
    jws: 'eyJhbGciOiJFUzI1NiIsImtpZCI6Indhc2UtYWEtMjAyNi0wMSJ9.eyJkb2NfaWQiOiI5OTJjMzM0NC1lNTNjLTQ0ZjYtZDkzNC0zMzQ0NTU2NjAwMDQiLCJ0eXBlIjoiTG9jYWwgcGVybWl0IiwiaG9sZGVyX25hbWUiOiJUYXJpayBBc3NlZmEiLCJob2xkZXJfaWQiOiI0MDE5LTgyODMtNTE5Mi0wMDU0IiwiaXNzdWVkX2F0IjoiMjAyNi0xMC0xNVQwOTowMDowMFoiLCJleHBpcmVzX2F0IjoiMjAyOC0xMC0xNVQxNzowMDowMFoiLCJpc3N1ZXJfY29kZSI6IkVUTEFORDA0In0.G_m129hZ59-4kH'
  }
];

/**
 * Generate an RGBA pixel buffer from payload using Level M and >= 4 modules quiet zone
 */
function generateQrRgba(payload, scale = 6, margin = 4) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const modSize = qr.modules.size;
  const fullSize = modSize + margin * 2;
  const width = fullSize * scale;
  const height = width;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255); // White background (quiet zone)

  for (let r = 0; r < modSize; r++) {
    for (let c = 0; c < modSize; c++) {
      if (qr.modules.get(r, c)) {
        const startX = (c + margin) * scale;
        const startY = (r + margin) * scale;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const idx = ((startY + y) * width + (startX + x)) * 4;
            data[idx] = 0;     // R
            data[idx + 1] = 0; // G
            data[idx + 2] = 0; // B
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  return { data, width, height, modSize };
}

/**
 * Four-stage decoding pipeline matching VerifyPage.jsx and wasenet-site-v3.html
 */
function decodeFourStage(imageObj) {
  const { data, width, height } = imageObj;

  // 1. Full Frame
  let code = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return { stage: 'full_frame', data: code.data };

  // 2. Centered Crop (inner 70%)
  const cropW = Math.floor(width * 0.7);
  const cropH = Math.floor(height * 0.7);
  const startX = Math.floor((width - cropW) / 2);
  const startY = Math.floor((height - cropH) / 2);
  const cropData = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = ((startY + y) * width + (startX + x)) * 4;
      const dstIdx = (y * cropW + x) * 4;
      cropData[dstIdx] = data[srcIdx];
      cropData[dstIdx + 1] = data[srcIdx + 1];
      cropData[dstIdx + 2] = data[srcIdx + 2];
      cropData[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  code = jsQR(cropData, cropW, cropH, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return { stage: 'centered_crop', data: code.data };

  // 3. Downscaled copy (50%)
  const downW = Math.floor(width / 2);
  const downH = Math.floor(height / 2);
  const downData = new Uint8ClampedArray(downW * downH * 4);
  for (let y = 0; y < downH; y++) {
    for (let x = 0; x < downW; x++) {
      const srcIdx = (y * 2 * width + x * 2) * 4;
      const dstIdx = (y * downW + x) * 4;
      downData[dstIdx] = data[srcIdx];
      downData[dstIdx + 1] = data[srcIdx + 1];
      downData[dstIdx + 2] = data[srcIdx + 2];
      downData[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  code = jsQR(downData, downW, downH, { inversionAttempts: 'dontInvert' });
  if (code && code.data) return { stage: 'downscaled', data: code.data };

  // 4. Inverted copy (photo negative / dark background)
  const invData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    invData[i] = 255 - data[i];
    invData[i + 1] = 255 - data[i + 1];
    invData[i + 2] = 255 - data[i + 2];
    invData[i + 3] = data[i + 3];
  }
  code = jsQR(invData, width, height, { inversionAttempts: 'invertFirst' });
  if (code && code.data) return { stage: 'inverted', data: code.data };

  return null;
}

function runTests() {
  console.log('========================================================');
  console.log('RUNNING QR GENERATION & DECODING TEST FOR 4 DOC TYPES');
  console.log('========================================================\n');

  let passed = 0;

  for (const doc of DOCUMENT_TYPES) {
    console.log(`Testing Document Type: "${doc.type}"...`);

    // 1. Generate QR code
    const qrImg = generateQrRgba(doc.jws, 6, 4);
    assert(qrImg.width >= 240, `QR image width must be >= 240px, got ${qrImg.width}px`);
    console.log(`  ✓ Generated Level M QR code (${qrImg.width}x${qrImg.height}px, 4-module quiet zone)`);

    // 2. Test Stage 1: Full Frame
    const result1 = decodeFourStage(qrImg);
    assert(result1 !== null, 'Failed to decode full frame QR');
    assert.strictEqual(result1.data, doc.jws, 'Decoded text does not match original payload');
    assert.strictEqual(result1.stage, 'full_frame', 'Expected full_frame stage');
    console.log(`  ✓ Stage 1 (Full frame) decoded successfully`);

    // 3. Test Stage 2: Center Cropped inside padded ambient frame
    // Place QR in center of a larger canvas (representing camera view)
    const padW = Math.floor(qrImg.width * 1.35);
    const padH = Math.floor(qrImg.height * 1.35);
    const paddedData = new Uint8ClampedArray(padW * padH * 4);
    paddedData.fill(200); // ambient gray background
    const offsetX = Math.floor((padW - qrImg.width) / 2);
    const offsetY = Math.floor((padH - qrImg.height) / 2);
    for (let y = 0; y < qrImg.height; y++) {
      for (let x = 0; x < qrImg.width; x++) {
        const src = (y * qrImg.width + x) * 4;
        const dst = ((offsetY + y) * padW + (offsetX + x)) * 4;
        paddedData[dst] = qrImg.data[src];
        paddedData[dst + 1] = qrImg.data[src + 1];
        paddedData[dst + 2] = qrImg.data[src + 2];
        paddedData[dst + 3] = 255;
      }
    }
    const cropResult = decodeFourStage({ data: paddedData, width: padW, height: padH });
    assert(cropResult !== null, 'Failed to decode centered crop');
    assert.strictEqual(cropResult.data, doc.jws, 'Decoded crop does not match original');
    console.log(`  ✓ Stage 2 (Centered crop / ambient framing) decoded successfully (${cropResult.stage})`);

    // 4. Test Stage 4: Inverted color scheme (white on black)
    const invData = new Uint8ClampedArray(qrImg.data.length);
    for (let i = 0; i < qrImg.data.length; i += 4) {
      invData[i] = 255 - qrImg.data[i];
      invData[i + 1] = 255 - qrImg.data[i + 1];
      invData[i + 2] = 255 - qrImg.data[i + 2];
      invData[i + 3] = 255;
    }
    const invResult = decodeFourStage({ data: invData, width: qrImg.width, height: qrImg.height });
    assert(invResult !== null, 'Failed to decode inverted QR code');
    assert.strictEqual(invResult.data, doc.jws, 'Inverted decode does not match payload');
    assert.strictEqual(invResult.stage, 'inverted', 'Expected inverted stage');
    console.log(`  ✓ Stage 4 (Inverted copy) decoded successfully`);

    passed++;
    console.log(`  ==> PASS: "${doc.type}" verified successfully.\n`);
  }

  console.log('========================================================');
  console.log(`ALL ${passed} OF ${DOCUMENT_TYPES.length} DOCUMENT TYPES PASSED VERIFICATION!`);
  console.log('========================================================');
}

runTests();
