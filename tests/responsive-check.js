import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\7550c3b8-f4d1-4144-80fa-1bde68d4ee24';

const SIZES = [
  { name: '320x568-small-phone-portrait', width: 320, height: 568 },
  { name: '360x740-android-portrait', width: 360, height: 740 },
  { name: '360x740-android-landscape', width: 740, height: 360 },
  { name: '390x844-modern-phone-portrait', width: 390, height: 844 },
  { name: '768x1024-tablet-portrait', width: 768, height: 1024 },
  { name: '768x1024-tablet-landscape', width: 1024, height: 768 },
  { name: '1024x768-small-laptop', width: 1024, height: 768 },
  { name: '1440x900-desktop', width: 1440, height: 900 }
];

const ROUTES = [
  { path: '', label: 'landing' },
  { path: '#/verify', label: 'scanner' },
  { path: '#/login', label: 'login' },
  { path: '#/sync', label: 'sync' },
  { path: '#/test', label: 'tests' }
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting Headless Chrome on port', PORT);
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-profile');
  
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
    if (!pages || pages.length === 0) {
      throw new Error('No pages returned by Chrome');
    }
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    let msgId = 1;
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

    console.log('\n=============================================');
    console.log('BEGINNING FULL CDP RESPONSIVE AUDIT & CAPTURE');
    console.log('=============================================\n');

    // Warm-up initial load so Vite finishes dev compilation
    await send('Page.navigate', { url: BASE_URL });
    await sleep(1200);

    const results = [];

    for (const size of SIZES) {
      console.log(`\n--- Testing Screen: ${size.name} (${size.width} x ${size.height}) ---`);

      const isMobile = size.width < 768;

      await send('Emulation.setUserAgentOverride', {
        userAgent: isMobile
          ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
      });

      await send('Emulation.setDeviceMetricsOverride', {
        width: size.width,
        height: size.height,
        deviceScaleFactor: 2,
        mobile: isMobile,
        screenOrientation: {
          type: size.width > size.height ? 'landscapePrimary' : 'portraitPrimary',
          angle: size.width > size.height ? 90 : 0
        }
      });

      for (const route of ROUTES) {
        const targetUrl = `${BASE_URL}/${route.path}`;
        await send('Page.navigate', { url: targetUrl });
        await sleep(500);

        // Evaluate overflow and metrics
        const evalRes = await send('Runtime.evaluate', {
          expression: `(() => {
            const innerWidth = window.innerWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const bodyScrollWidth = document.body.scrollWidth;
            const hasHorizontalScroll = scrollWidth > innerWidth + 1 || bodyScrollWidth > innerWidth + 1;
            
            // Check overflowing elements
            const overflowing = [];
            document.querySelectorAll('*').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.right > innerWidth + 1) {
                overflowing.push({
                  tag: el.tagName,
                  cls: el.className ? String(el.className) : '',
                  id: el.id,
                  right: Math.round(rect.right),
                  width: Math.round(rect.width)
                });
              }
            });

            return {
              innerWidth,
              scrollWidth,
              hasHorizontalScroll,
              overflowCount: overflowing.length,
              overflowingSample: overflowing.slice(0, 3)
            };
          })()`,
          returnByValue: true
        });

        const check = (evalRes && evalRes.result && evalRes.result.value) ? evalRes.result.value : (evalRes && evalRes.value ? evalRes.value : evalRes);
        if (!check || typeof check !== 'object') {
          console.error('Failed to get eval output, raw response was:', evalRes);
          continue;
        }

        const pass = !check.hasHorizontalScroll && check.overflowCount === 0;
        console.log(`  [${size.name}] Route "${route.label}": ${pass ? '✔ PASS' : '✖ FAIL'} (Window: ${check.innerWidth}px, Scroll: ${check.scrollWidth}px, Overflowing: ${check.overflowCount})`);

        if (!pass) {
          console.log('    Sample Overflowing:', JSON.stringify(check.overflowingSample));
        }

        results.push({
          size: `${size.width}x${size.height}`,
          name: size.name,
          route: route.label,
          pass,
          scrollWidth: check.scrollWidth,
          innerWidth: check.innerWidth
        });

        // Capture screenshot of primary screens
        if (route.label === 'landing' || route.label === 'scanner') {
          const ss = await send('Page.captureScreenshot', { format: 'png' });
          const outName = `${size.name}-${route.label}.png`;
          const outPath = path.join(ARTIFACT_DIR, outName);
          fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
        }
      }

      // Test Amharic language switch on 320x568
      if (size.width === 320) {
        console.log('\n  Testing Amharic localization toggle on 320px viewport...');
        await send('Runtime.evaluate', {
          expression: `(() => {
            const btn = document.getElementById('lang-toggle-btn-mobile') || document.getElementById('lang-toggle-btn');
            if (btn) btn.click();
          })()`
        });
        await sleep(350);

        const amharicEval = await send('Runtime.evaluate', {
          expression: `(() => {
            const lang = document.documentElement.lang;
            const scrollWidth = document.documentElement.scrollWidth;
            const innerWidth = window.innerWidth;
            return { lang, scrollWidth, innerWidth, pass: scrollWidth <= innerWidth + 1 };
          })()`,
          returnByValue: true
        });
        const amRes = (amharicEval && amharicEval.result && amharicEval.result.value) ? amharicEval.result.value : amharicEval.value;
        if (amRes) {
          console.log(`  Amharic toggle result: lang="${amRes.lang}", scrollWidth=${amRes.scrollWidth}px, innerWidth=${amRes.innerWidth}px -> ${amRes.pass ? '✔ PASS' : '✖ FAIL'}`);
        }

        const amSs = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, '320x568-amharic-landing.png'), Buffer.from(amSs.data, 'base64'));
      }
    }

    console.log('\n=============================================');
    console.log('SUMMARY AUDIT RESULTS:');
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    console.log(`Total Checks: ${total}`);
    console.log(`Passed: ${passed} / ${total} (${Math.round((passed / total) * 100)}%)`);
    console.log('Screenshots saved to artifact directory.');
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
  console.error('Error during responsive audit check:', err);
  process.exit(1);
});
