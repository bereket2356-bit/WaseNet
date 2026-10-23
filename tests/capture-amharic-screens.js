import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9248;
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7550c3b8-f4d1-4144-80fa-1bde68d4ee24';

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

async function main() {
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-screens-profile');

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

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await listRes.json();
    const targetPage = pages.find(p => p.type === 'page' && !p.url.startsWith('chrome-extension')) || pages[0];
    const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
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

    await send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    // 1. Initial load and set language to Amharic
    await send('Page.navigate', { url: BASE_URL });
    await sleep(1000);

    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_lang', 'am');
      document.documentElement.lang = 'am';
      const btn = document.getElementById('lang-toggle-btn-mobile') || document.getElementById('lang-toggle-btn');
      // If current button shows 'አማርኛ', clicking switches to Amharic
      if (btn && btn.innerText.includes('አማርኛ')) {
        btn.click();
      }
    })()`);
    await sleep(600);

    // Set auth in localStorage
    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_user', JSON.stringify({
        username: 'issuer',
        role: 'issuer',
        exp: Math.floor(Date.now() / 1000) + 28800
      }));
      localStorage.setItem('wasenet_jwt', 'mock-token-session');
    })()`);

    // 2. Load Valid Result in Amharic
    console.log('Generating valid credential and loading Result page...');
    const bannerInfo = await evalExpr(send, `(async () => {
      try {
        const { getSampleTokens } = await import('/src/sample-docs.js');
        const tokens = await getSampleTokens();
        if (!tokens || !tokens.valid) return { error: 'tokens null or invalid', tokens };
        sessionStorage.setItem('wase_verify_jws', tokens.valid);
        window.location.hash = '#/result?jws=' + encodeURIComponent(tokens.valid);
        return { loaded: true, tokenPrefix: tokens.valid.slice(0, 20) };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`);
    console.log('Loaded token into sessionStorage:', bannerInfo);
    await sleep(2000);

    const bannerCheck = await evalExpr(send, `(() => {
      const title = document.querySelector('.banner-title');
      const msg = document.querySelector('.banner-message');
      const banner = document.querySelector('.result-banner');
      return {
        lang: document.documentElement.lang,
        hasBanner: !!banner,
        title: title ? title.innerText : null,
        titleFont: title ? window.getComputedStyle(title).fontFamily : null,
        msg: msg ? msg.innerText : null,
        msgFont: msg ? window.getComputedStyle(msg).fontFamily : null
      };
    })()`);
    console.log('Result Banner Check:', JSON.stringify(bannerCheck));

    const ssResult = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-scanner-result-banner.png'), Buffer.from(ssResult.data, 'base64'));
    console.log('Saved amharic-scanner-result-banner.png');

    // 3. Capture Issuer Form
    await send('Page.navigate', { url: `${BASE_URL}/#/issue` });
    await sleep(1000);
    const ssIssue = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-issuer-form-authenticated.png'), Buffer.from(ssIssue.data, 'base64'));
    console.log('Saved amharic-issuer-form-authenticated.png');

    ws.close();
  } finally {
    chromeProc.kill('SIGKILL');
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch(console.error);
