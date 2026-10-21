import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9232;
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7550c3b8-f4d1-4144-80fa-1bde68d4ee24';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evalExpr(send, expression) {
  const evalRes = await send('Runtime.evaluate', { expression, returnByValue: true });
  return (evalRes && evalRes.result && evalRes.result.value !== undefined)
    ? evalRes.result.value
    : (evalRes && evalRes.value !== undefined ? evalRes.value : evalRes);
}

async function main() {
  console.log('Starting Headless Chrome for Banner & Screen captures...');
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-banner-profile');

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
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = id++;
        pending.set(curId, { resolve, reject });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');

    // Emulate 390px mobile phone
    await send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Warm-up initial load
    await send('Page.navigate', { url: BASE_URL });
    await sleep(1200);

    // Set Amharic
    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_lang', 'am');
      document.documentElement.lang = 'am';
    })()`);

    // 1. Capture Amharic Scanner
    await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
    await sleep(800);
    const ssScannerAm = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-scanner-390px.png'), Buffer.from(ssScannerAm.data, 'base64'));

    // 2. Capture Amharic Issuer Form
    await send('Page.navigate', { url: `${BASE_URL}/#/issue` });
    await sleep(800);
    const ssIssueAm = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-issuer-form-390px.png'), Buffer.from(ssIssueAm.data, 'base64'));

    // 3. Capture 4 Result Banner states
    const states = ['valid', 'tampered', 'revoked', 'expired'];
    for (const st of states) {
      console.log(`Loading Amharic result state: ${st}...`);
      await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
      await sleep(600);

      await evalExpr(send, `(async () => {
        const { getSampleTokens } = await import('/src/sample-docs.js');
        const tokens = await getSampleTokens();
        sessionStorage.setItem('wase_verify_jws', tokens['${st}']);
        window.location.hash = '#/result?jws=' + encodeURIComponent(tokens['${st}']);
      })()`);
      await sleep(1000);

      const check = await evalExpr(send, `(() => {
        const title = document.querySelector('.banner-title');
        const msg = document.querySelector('.banner-message');
        const banner = document.querySelector('.result-banner');
        return {
          status: '${st}',
          title: title ? title.innerText : null,
          titleFont: title ? window.getComputedStyle(title).fontFamily : null,
          msgFont: msg ? window.getComputedStyle(msg).fontFamily : null,
          bannerClass: banner ? banner.className : null
        };
      })()`);
      console.log(`  [State ${st}]`, JSON.stringify(check));

      const ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, `amharic-result-banner-${st}.png`), Buffer.from(ss.data, 'base64'));
    }

    // 4. Capture English Scanner and Issuer Form for comparison
    console.log('Switching to English for comparison captures...');
    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_lang', 'en');
      document.documentElement.lang = 'en';
    })()`);

    await send('Page.navigate', { url: `${BASE_URL}/#/verify` });
    await sleep(800);
    const ssScannerEn = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'english-scanner-390px.png'), Buffer.from(ssScannerEn.data, 'base64'));

    await send('Page.navigate', { url: `${BASE_URL}/#/issue` });
    await sleep(800);
    const ssIssueEn = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'english-issuer-form-390px.png'), Buffer.from(ssIssueEn.data, 'base64'));

    console.log('All screenshots captured successfully.');
    ws.close();
  } finally {
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch(console.error);
