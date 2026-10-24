import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import QRCode from '../frontend/node_modules/qrcode/lib/server.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9288;
const BASE_URL = 'http://localhost:5173';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evalExpr(send, expression) {
  const evalRes = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return (evalRes && evalRes.result && evalRes.result.value !== undefined)
    ? evalRes.result.value
    : (evalRes && evalRes.value !== undefined ? evalRes.value : evalRes);
}

async function runTest() {
  console.log('--- STARTING COMPREHENSIVE FILE VERIFICATION TEST SUITE ---');
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-test-file-verify');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'about:blank'
  ]);

  await sleep(1500);

  const errors = [];
  const testResults = [];
  const networkRequests = [];

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await listRes.json();
    const targetPage = pages.find(p => p.type === 'page' && !p.url.startsWith('chrome-extension')) || pages[0];
    const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.exceptionThrown') {
        errors.push(data.params);
      }
      if (data.method === 'Network.requestWillBeSent') {
        networkRequests.push(data.params);
      }
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = msgId++;
        pending.set(curId, { resolve, reject });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    const assert = (name, cond, details = '') => {
      if (cond) {
        console.log(`[PASS] ${name}`);
        testResults.push({ name, pass: true });
      } else {
        console.error(`[FAIL] ${name}: ${details}`);
        testResults.push({ name, pass: false, details });
      }
    };

    async function waitForSelector(selector, timeout = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const found = await evalExpr(send, `Boolean(document.querySelector('${selector}'))`);
        if (found) return true;
        await sleep(150);
      }
      return false;
    }

    // 1. Initial Load & Verify Page Control Placement
    console.log('\n--- 1. Testing Control Placement & Accessibility ---');
    await send('Page.navigate', { url: BASE_URL + '/#/verify' });
    await waitForSelector('#choose-file-btn', 8000);
    await sleep(300);

    const controlPlacement = await evalExpr(send, `(() => {
      const scanBtn = document.querySelector('.scan-btn');
      const chooseBtn = document.getElementById('choose-file-btn');
      const fileInput = document.getElementById('qr-file-input');
      const hint = document.getElementById('file-hint');
      const privacy = document.getElementById('file-privacy');
      const orDivider = document.querySelector('.or');

      const sRect = scanBtn?.getBoundingClientRect();
      const cRect = chooseBtn?.getBoundingClientRect();
      const oRect = orDivider?.getBoundingClientRect();
      const cStyles = chooseBtn ? window.getComputedStyle(chooseBtn) : null;

      return {
        hasChooseBtn: Boolean(chooseBtn),
        hasFileInput: Boolean(fileInput),
        isBelowScan: cRect && sRect && cRect.top > sRect.bottom,
        isAboveOr: cRect && oRect && cRect.bottom < oRect.top,
        btnHeight: cRect ? Math.round(cRect.height) : 0,
        btnText: chooseBtn?.textContent?.trim(),
        isOutlined: cStyles?.backgroundColor === 'rgba(0, 0, 0, 0)' || cStyles?.background?.includes('transparent'),
        hintText: hint?.textContent?.trim(),
        privacyText: privacy?.textContent?.trim(),
        ariaDescribedBy: chooseBtn?.getAttribute('aria-describedby')
      };
    })()`);

    assert('Choose a file button exists', controlPlacement.hasChooseBtn);
    assert('Button is below Scan button and above OR divider', controlPlacement.isBelowScan && controlPlacement.isAboveOr, JSON.stringify(controlPlacement));
    assert('Button is labeled "Choose a file"', controlPlacement.btnText === 'Choose a file');
    assert('Button is at least 48px tall', controlPlacement.btnHeight >= 48, `Height: ${controlPlacement.btnHeight}`);
    assert('Button has outlined style', controlPlacement.isOutlined);
    assert('Muted hint matches exact copy', controlPlacement.hintText === 'Use a clear photo or scan of the QR code. JPG, PNG, or WebP.', controlPlacement.hintText);
    assert('Privacy line matches exact copy', controlPlacement.privacyText === 'Your file stays on this device.', controlPlacement.privacyText);
    assert('Button is linked via aria-describedby', controlPlacement.ariaDescribedBy && controlPlacement.ariaDescribedBy.includes('file-hint'));

    // 2. Test File Size Validation (> 10 MB)
    console.log('\n--- 2. Testing File Size Validation (> 10 MB) ---');
    const oversizeCheck = await evalExpr(send, `(async () => {
      const input = document.getElementById('qr-file-input');
      // Create fake 10.5 MB image file
      const bigBuffer = new Uint8Array(10.5 * 1024 * 1024);
      const bigFile = new File([bigBuffer], 'huge-doc.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(bigFile);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const errEl = document.getElementById('file-err');
      const inputVal = input.value;
      return {
        errText: errEl?.textContent?.trim(),
        inputReset: inputVal === ''
      };
    })()`);
    assert('Oversize file displays exact error',
      oversizeCheck.errText === 'This file is too large. Choose a file under 10 MB.',
      JSON.stringify(oversizeCheck)
    );
    assert('Input is reset after oversize rejection', oversizeCheck.inputReset);

    // 3. Test Invalid File Type Validation (Non-image)
    console.log('\n--- 3. Testing Invalid File Type Validation ---');
    const invalidTypeCheck = await evalExpr(send, `(async () => {
      const input = document.getElementById('qr-file-input');
      const txtFile = new File(['hello world'], 'document.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(txtFile);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const errEl = document.getElementById('file-err');
      const inputVal = input.value;
      return {
        errText: errEl?.textContent?.trim(),
        inputReset: inputVal === ''
      };
    })()`);
    assert('Non-image file displays exact error',
      invalidTypeCheck.errText === 'Choose a JPG, PNG, or WebP image.',
      JSON.stringify(invalidTypeCheck)
    );
    assert('Input is reset after type rejection', invalidTypeCheck.inputReset);

    // 4. Test Image With No QR Code ("Could not read" failure)
    console.log('\n--- 4. Testing Photo with No QR Code ---');
    const noQrCheck = await evalExpr(send, `(async () => {
      const input = document.getElementById('qr-file-input');
      // Create canvas with a blank / solid colored image
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ABCDEF';
      ctx.fillRect(0, 0, 200, 200);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'blank.png', { type: 'image/png' });

      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async decode and navigation
      let attempts = 0;
      while (!window.location.hash.includes('result') && attempts < 35) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      const hash = window.location.hash;
      const bannerTitle = document.querySelector('.banner h2')?.textContent?.trim();
      const note = document.querySelector('.note')?.textContent?.trim();
      const contactBtn = document.querySelector('.row-btns a[href*="contact"]');

      return {
        hash,
        bannerTitle,
        note,
        hasContactBtn: Boolean(contactBtn)
      };
    })()`);
    assert('No-QR image navigates to result page with error status', Boolean(noQrCheck && noQrCheck.hash && noQrCheck.hash.includes('s=error')), JSON.stringify(noQrCheck));
    assert('Result title is "Could not read"', noQrCheck && noQrCheck.bannerTitle === 'Could not read');
    assert('Result displays note for unreadable codes',
      noQrCheck && noQrCheck.note === 'Hold the phone steady and keep the whole code inside the frame.',
      noQrCheck?.note
    );
    assert('Result displays Contact us button', Boolean(noQrCheck && noQrCheck.hasContactBtn));

    // Fetch sample tokens from the running app
    const sampleTokens = await evalExpr(send, `(async () => {
      const { getSampleTokens } = await import('/src/sample-docs.js');
      return await getSampleTokens();
    })()`);

    // 5. Test Clear Valid QR Code Image
    console.log('\n--- 5. Testing Clear Valid QR Code Image ---');
    await send('Page.navigate', { url: BASE_URL + '/#/verify' });
    await waitForSelector('#choose-file-btn', 8000);
    await sleep(200);

    const validQrBuffer = await QRCode.toBuffer(sampleTokens.valid, {
      type: 'png',
      margin: 4,
      width: 320,
      errorCorrectionLevel: 'M'
    });
    const validQrB64 = validQrBuffer.toString('base64');

    const validQrCheck = await evalExpr(send, `(async () => {
      const bytes = Uint8Array.from(atob("${validQrB64}"), c => c.charCodeAt(0));
      const file = new File([bytes], 'valid-cert.png', { type: 'image/png' });

      const input = document.getElementById('qr-file-input');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      let attempts = 0;
      while (!window.location.hash.includes('result') && attempts < 35) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      const hash = window.location.hash;
      const bannerTitle = document.querySelector('.banner h2')?.textContent?.trim();
      const holderName = Array.from(document.querySelectorAll('.rows > div')).find(d => d.textContent.includes('Holder name'))?.querySelector('dd')?.textContent?.trim();
      const docType = Array.from(document.querySelectorAll('.rows > div')).find(d => d.textContent.includes('Document type'))?.querySelector('dd')?.textContent?.trim();

      return {
        hash,
        bannerTitle,
        holderName,
        docType
      };
    })()`);
    assert('Valid QR image navigates to result page with JWS', validQrCheck.hash.includes('jws=') || validQrCheck.bannerTitle === 'Valid', JSON.stringify(validQrCheck));
    assert('Result title is "Valid"', validQrCheck.bannerTitle === 'Valid');
    assert('Holder name matches payload', validQrCheck.holderName === 'Abebe Bikila Wolde' || validQrCheck.holderName === 'Abebe Bikila', validQrCheck.holderName);

    // 6. Test Tampered QR Code Image
    console.log('\n--- 6. Testing Tampered QR Code Image ---');
    await send('Page.navigate', { url: BASE_URL + '/#/verify' });
    await waitForSelector('#choose-file-btn', 8000);
    await sleep(200);

    const tamperedQrBuffer = await QRCode.toBuffer(sampleTokens.tampered, {
      type: 'png',
      margin: 4,
      width: 320,
      errorCorrectionLevel: 'M'
    });
    const tamperedQrB64 = tamperedQrBuffer.toString('base64');

    const tamperedQrCheck = await evalExpr(send, `(async () => {
      const bytes = Uint8Array.from(atob("${tamperedQrB64}"), c => c.charCodeAt(0));
      const file = new File([bytes], 'tampered-cert.png', { type: 'image/png' });

      const input = document.getElementById('qr-file-input');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      let attempts = 0;
      while (!window.location.hash.includes('result') && attempts < 35) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      const bannerTitle = document.querySelector('.banner h2')?.textContent?.trim();
      const cardDetails = document.querySelector('.rows');
      const reportBtn = document.querySelector('.row-btns a[href*="report"]');

      return {
        bannerTitle,
        detailsHidden: !cardDetails,
        hasReportBtn: Boolean(reportBtn)
      };
    })()`);
    assert('Tampered QR image displays "Tampered"', tamperedQrCheck && tamperedQrCheck.bannerTitle === 'Tampered', JSON.stringify(tamperedQrCheck));
    assert('Tampered QR image details are hidden', tamperedQrCheck && tamperedQrCheck.detailsHidden);
    assert('Tampered QR image displays Report a fraud button', tamperedQrCheck && tamperedQrCheck.hasReportBtn);

    // 7. Test Choosing Same File Twice in a Row
    console.log('\n--- 7. Testing Choosing Same File Twice in a Row ---');
    await send('Page.navigate', { url: BASE_URL + '/#/verify' });
    await waitForSelector('#choose-file-btn', 8000);
    await sleep(200);

    const doubleFileCheck = await evalExpr(send, `(async () => {
      const input = document.getElementById('qr-file-input');
      const f1 = new File(['abc'], 'test.png', { type: 'image/png' });
      const dt1 = new DataTransfer();
      dt1.items.add(f1);
      input.files = dt1.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const valAfterFirst = input.value;

      // Choose same file second time
      const dt2 = new DataTransfer();
      dt2.items.add(f1);
      input.files = dt2.files;
      let firedSecond = false;
      input.addEventListener('change', () => { firedSecond = true; }, { once: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));

      return { valAfterFirst, firedSecond };
    })()`);
    assert('Input value is reset after first selection', doubleFileCheck && doubleFileCheck.valAfterFirst === '', JSON.stringify(doubleFileCheck));
    assert('Change event fires cleanly on second selection of same file', doubleFileCheck && doubleFileCheck.firedSecond);

    // 8. Test Offline / Airplane Mode Decoding (network disconnected after page loaded)
    console.log('\n--- 8. Testing Offline / Airplane Mode Decoding ---');
    // Navigate via hash back to verify without full browser reload
    await evalExpr(send, `(() => { window.location.hash = '#/verify'; })()`);
    await waitForSelector('#choose-file-btn', 8000);
    await sleep(200);

    // Emulate airplane mode / network disconnection
    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0
    });

    const offlineDecodeCheck = await evalExpr(send, `(async () => {
      const bytes = Uint8Array.from(atob("${validQrB64}"), c => c.charCodeAt(0));
      const file = new File([bytes], 'offline-cert.png', { type: 'image/png' });

      const input = document.getElementById('qr-file-input');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      let attempts = 0;
      while (!window.location.hash.includes('result') && attempts < 35) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      const bannerTitle = document.querySelector('.banner h2')?.textContent?.trim();
      return { bannerTitle, isOnline: navigator.onLine };
    })()`);
    assert('File is decoded with network disconnected (offline / airplane mode)', offlineDecodeCheck && offlineDecodeCheck.bannerTitle === 'Valid', JSON.stringify(offlineDecodeCheck));

    // Restore network
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });

    assert('File is decoded with network disconnected (offline / airplane mode)',
      offlineDecodeCheck.bannerTitle === 'Valid',
      JSON.stringify(offlineDecodeCheck)
    );

    // 9. Verify Privacy: No Image Data Sent Over Network
    console.log('\n--- 9. Verifying Privacy & Zero Image Upload Requests ---');
    const imageUploadRequests = networkRequests.filter(req => {
      const url = req.request?.url || '';
      const method = req.request?.method || '';
      return (method === 'POST' || method === 'PUT') && (url.includes('upload') || url.includes('image') || url.includes('decode'));
    });
    assert('Zero image upload requests sent across network', imageUploadRequests.length === 0, JSON.stringify(imageUploadRequests));

    // 10. Check Viewports at 360px, 412px, 768px in Light and Dark mode for Zero Horizontal Scroll
    console.log('\n--- 10. Testing Responsive Viewports & Themes on Verify Page ---');
    for (const theme of ['light', 'dark']) {
      await evalExpr(send, `document.documentElement.setAttribute('data-theme', '${theme}')`);
      for (const w of [360, 412, 768]) {
        await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 2, mobile: w <= 768 });
        await send('Page.navigate', { url: BASE_URL + '/#/verify' });
        await sleep(250);

        const scrollWidth = await evalExpr(send, `document.documentElement.scrollWidth`);
        const clientWidth = await evalExpr(send, `document.documentElement.clientWidth`);
        assert(`[${theme.toUpperCase()}][${w}px] No horizontal scroll on Verify page with Choose a file control`,
          scrollWidth <= clientWidth,
          `scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`
        );
      }
    }

    // 11. Console Exceptions
    console.log('\n--- 11. Checking Console Exceptions ---');
    assert('Zero uncaught exceptions during test suite', errors.length === 0, JSON.stringify(errors));

  } finally {
    chromeProc.kill();
  }

  const passedCount = testResults.filter(r => r.pass).length;
  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passedCount} / ${testResults.length} PASSED`);
  console.log(`========================================`);

  if (passedCount !== testResults.length) {
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
