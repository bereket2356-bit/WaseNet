import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9230;
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7550c3b8-f4d1-4144-80fa-1bde68d4ee24';

const SIZES = [
  { name: '320px-small-phone', width: 320, height: 600, isMobile: true },
  { name: '390px-modern-phone', width: 390, height: 844, isMobile: true },
  { name: '1440px-desktop', width: 1440, height: 900, isMobile: false }
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalExpr(send, expression) {
  const evalRes = await send('Runtime.evaluate', { expression, returnByValue: true });
  return (evalRes && evalRes.result && evalRes.result.value !== undefined)
    ? evalRes.result.value
    : (evalRes && evalRes.value !== undefined ? evalRes.value : evalRes);
}

async function main() {
  console.log('Starting Headless Chrome on port', PORT);
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-font-profile');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  await sleep(1500);

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    const pending = new Map();
    const networkResponses = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Network.responseReceived') {
        const url = data.params.response.url;
        const status = data.params.response.status;
        networkResponses.push({ url, status });
        if (url.includes('fonts/')) {
          console.log(`[Font Network Response] ${status} ${url}`);
        }
      }
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Network.enable');

    console.log('\n=============================================');
    console.log('BEGINNING COMPLETE AMHARIC FONT & UI TEST');
    console.log('=============================================\n');

    // 1. Initial warm-up
    await send('Page.navigate', { url: BASE_URL });
    await sleep(1500);

    // Set language in localStorage to 'am' and reload so app boots in Amharic
    console.log('Setting persistent language to Amharic (am)...');
    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_lang', 'am');
      document.documentElement.lang = 'am';
    })()`);

    await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
    await sleep(1000);

    const initialLang = await evalExpr(send, `document.documentElement.lang`);
    console.log(`Verified active document lang: "${initialLang}" (Expected: "am")`);

    // 2. Test screens across viewports
    for (const size of SIZES) {
      console.log(`\n--- Testing Screens at ${size.name} (${size.width}x${size.height}) ---`);

      await send('Emulation.setUserAgentOverride', {
        userAgent: size.isMobile
          ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
      });

      await send('Emulation.setDeviceMetricsOverride', {
        width: size.width,
        height: size.height,
        deviceScaleFactor: 2,
        mobile: size.isMobile
      });

      // 2A. Scanner Screen (#/verify)
      await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
      await sleep(700);

      const scannerFonts = await evalExpr(send, `(() => {
        const h1 = document.querySelector('h1');
        const btn = document.querySelector('button.btn');
        const body = document.body;
        return {
          lang: document.documentElement.lang,
          h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
          btnFont: btn ? window.getComputedStyle(btn).fontFamily : null,
          bodyFont: window.getComputedStyle(body).fontFamily,
          lineHeight: window.getComputedStyle(body).lineHeight
        };
      })()`);
      console.log('  [Scanner] Fonts:', JSON.stringify(scannerFonts));

      // 2B. Issuer Form Screen (#/issue)
      await send('Page.navigate', { url: `${BASE_URL}/#/issue` });
      await sleep(700);

      const issueFonts = await evalExpr(send, `(() => {
        const h1 = document.querySelector('h1');
        const label = document.querySelector('label');
        const input = document.querySelector('input');
        const btn = document.querySelector('button[type=submit]') || document.querySelector('.btn-primary');
        return {
          h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
          labelFont: label ? window.getComputedStyle(label).fontFamily : null,
          inputFont: input ? window.getComputedStyle(input).fontFamily : null,
          btnFont: btn ? window.getComputedStyle(btn).fontFamily : null
        };
      })()`);
      console.log('  [Issuer Form] Fonts:', JSON.stringify(issueFonts));

      // Capture screenshot of Issuer Form
      const ssIssue = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, `amharic-issuer-form-${size.name}.png`), Buffer.from(ssIssue.data, 'base64'));

      // 2C. Login Screen (#/login)
      await send('Page.navigate', { url: `${BASE_URL}/#/login` });
      await sleep(500);
      const loginFonts = await evalExpr(send, `(() => {
        const h1 = document.querySelector('h1');
        const label = document.querySelector('label');
        return {
          h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
          labelFont: label ? window.getComputedStyle(label).fontFamily : null
        };
      })()`);
      console.log('  [Login] Fonts:', JSON.stringify(loginFonts));

      // 2D. Admin Key Panel (#/admin/keys)
      await send('Page.navigate', { url: `${BASE_URL}/#/admin/keys` });
      await sleep(500);
      const adminFonts = await evalExpr(send, `(() => {
        const h1 = document.querySelector('h1');
        return { h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null };
      })()`);
      console.log('  [Admin Keys] Fonts:', JSON.stringify(adminFonts));

      // 2E. Audit Log View (#/audit)
      await send('Page.navigate', { url: `${BASE_URL}/#/audit` });
      await sleep(500);
      const auditFonts = await evalExpr(send, `(() => {
        const h1 = document.querySelector('h1');
        return { h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null };
      })()`);
      console.log('  [Audit Log] Fonts:', JSON.stringify(auditFonts));
    }

    // 3. Test Verification Result Banner in Amharic
    console.log('\n--- Testing Verification Result Banner in Amharic ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
    await sleep(1000);

    // Click "ሕጋዊ ምስክር ወረቀት ሞክር"
    await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sampleBtn = btns.find(b => b.innerText.includes('ሕጋዊ'));
      if (sampleBtn) sampleBtn.click();
    })()`);
    await sleep(1200);

    const bannerInfo = await evalExpr(send, `(() => {
      const title = document.querySelector('.banner-title');
      const msg = document.querySelector('.banner-message');
      const banner = document.querySelector('.result-banner');
      return {
        hasBanner: !!banner,
        title: title ? title.innerText : null,
        titleFont: title ? window.getComputedStyle(title).fontFamily : null,
        titleLineHeight: title ? window.getComputedStyle(title).lineHeight : null,
        msgFont: msg ? window.getComputedStyle(msg).fontFamily : null,
        bannerClass: banner ? banner.className : null
      };
    })()`);
    console.log('Valid Result Banner Info:', JSON.stringify(bannerInfo));

    // Capture Result Banner screenshot
    const bannerSs = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-result-banner-valid.png'), Buffer.from(bannerSs.data, 'base64'));

    // 4. Test Offline Mode
    console.log('\n--- Testing Offline Mode ---');
    await send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0
    });

    await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
    await sleep(800);

    const offlineFonts = await evalExpr(send, `(() => {
      const body = document.body;
      const h1 = document.querySelector('h1');
      return {
        onLine: navigator.onLine,
        lang: document.documentElement.lang,
        bodyFont: window.getComputedStyle(body).fontFamily,
        h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null
      };
    })()`);
    console.log('Offline Mode Fonts Check:', JSON.stringify(offlineFonts));

    // Restore online
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });

    // 5. Test Switch back to English
    console.log('\n--- Testing Switch back to English ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false
    });
    await send('Page.navigate', { url: `${BASE_URL}/` });
    await sleep(800);

    // Click language toggle to switch back to English
    await evalExpr(send, `(() => {
      const btn = document.getElementById('lang-toggle-btn') || document.getElementById('lang-toggle-btn-mobile');
      if (btn) btn.click();
    })()`);
    await sleep(800);

    const enStatus = await evalExpr(send, `(() => {
      const h1 = document.querySelector('h1');
      const body = document.body;
      return {
        lang: document.documentElement.lang,
        bodyFont: window.getComputedStyle(body).fontFamily,
        h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null
      };
    })()`);
    console.log('English Mode Restored Fonts Check:', JSON.stringify(enStatus));

    // Capture English landing screenshot
    const enSs = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'english-restored-landing.png'), Buffer.from(enSs.data, 'base64'));

    // 6. Network Font Requests Summary
    console.log('\n=============================================');
    console.log('FONT NETWORK REQUESTS & 404 AUDIT:');
    const fontRequests = networkResponses.filter(r => r.url.includes('fonts/'));
    console.log(`Total font requests intercepted: ${fontRequests.length}`);
    fontRequests.forEach(r => console.log(`  - [Status ${r.status}] ${r.url}`));
    const font404s = fontRequests.filter(r => r.status === 404);
    console.log(`Font 404 errors: ${font404s.length}`);
    console.log('=============================================\n');

    ws.close();
  } finally {
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch(err => {
  console.error('Error during font test:', err);
  process.exit(1);
});
