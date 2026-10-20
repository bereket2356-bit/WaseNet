import { spawn } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9224;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const proc = spawn(CHROME_PATH, ['--headless=new', `--remote-debugging-port=${PORT}`, 'about:blank']);
  await sleep(1500);
  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await listRes.json();
    const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === curId) {
          ws.removeEventListener('message', handler);
          if (d.error) reject(d.error);
          else resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await send('Page.enable');
    await send('DOM.enable');

    const urls = [
      'http://localhost:5173/',
      'http://localhost:5173/#/verify',
      'http://localhost:5173/#/login',
      'http://localhost:5173/#/sync',
      'http://localhost:5173/#/test'
    ];

    console.log('--- ACCESSIBILITY & CONTRAST & TOUCH TARGET AUDIT ---');

    for (const url of urls) {
      await send('Page.navigate', { url });
      await sleep(600);

      const check = await send('Runtime.evaluate', {
        expression: `(() => {
          const missingLabels = [];
          document.querySelectorAll('input, select, textarea').forEach(el => {
            const id = el.id;
            const label = id ? document.querySelector('label[for="' + id + '"]') : null;
            const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
            if (!label && !ariaLabel) {
              missingLabels.push({ tag: el.tagName, id: el.id, name: el.name });
            }
          });

          const missingButtonNames = [];
          document.querySelectorAll('button, a').forEach(el => {
            const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
            if (!text) {
              missingButtonNames.push({ tag: el.tagName, cls: el.className });
            }
          });

          const smallTouchTargets = [];
          document.querySelectorAll('button, a, input').forEach(el => {
            const rect = el.getBoundingClientRect();
            // Visible only
            if (rect.width > 0 && rect.height > 0 && (rect.width < 43 || rect.height < 43)) {
              // check if inside an intentional inline link or something
              if (el.tagName !== 'A' || el.innerText.length > 20) {
                smallTouchTargets.push({
                  tag: el.tagName,
                  text: (el.innerText || el.value || el.id || '').slice(0, 20),
                  w: Math.round(rect.width),
                  h: Math.round(rect.height)
                });
              }
            }
          });

          const metaViewport = document.querySelector('meta[name="viewport"]')?.content;
          const lang = document.documentElement.lang;

          return {
            url: window.location.hash || '/',
            lang,
            metaViewport,
            missingLabels,
            missingButtonNames,
            smallTouchTargets
          };
        })()`,
        returnByValue: true
      });

      const res = check.result.value;
      console.log(`\nURL: ${res.url}`);
      console.log(`  lang="${res.lang}", viewport="${res.metaViewport}"`);
      console.log(`  Missing Labels: ${res.missingLabels.length}`);
      console.log(`  Missing Button Names: ${res.missingButtonNames.length}`);
      console.log(`  Small Touch Targets (<44px): ${res.smallTouchTargets.length}`);
      if (res.smallTouchTargets.length > 0) {
        console.log('    Sample Small Targets:', JSON.stringify(res.smallTouchTargets.slice(0, 3)));
      }
    }

    ws.close();
  } finally {
    proc.kill('SIGKILL');
  }
}

run().catch(console.error);
