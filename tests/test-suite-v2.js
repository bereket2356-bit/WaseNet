import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9255;
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

async function runTestSuite() {
  console.log('--- STARTING COMPREHENSIVE WASENET TEST SUITE ---');
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-test-profile');

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

    const assert = (name, cond, details = '') => {
      if (cond) {
        console.log(`[PASS] ${name}`);
        testResults.push({ name, pass: true });
      } else {
        console.error(`[FAIL] ${name}: ${details}`);
        testResults.push({ name, pass: false, details });
      }
    };

    // 1. Initial Load & Baseline
    await send('Page.navigate', { url: BASE_URL + '/#/' });
    await sleep(1000);

    const docTitle = await evalExpr(send, `document.title`);
    assert('Home page loads with title', docTitle.includes('WaseNet'), `Title was: ${docTitle}`);

    // Check Header elements
    const headerInfo = await evalExpr(send, `(() => {
      const brand = document.querySelector('.brand');
      const navLinks = Array.from(document.querySelectorAll('nav a')).map(a => a.textContent.trim());
      const themeBtn = document.getElementById('theme');
      const langBtn = document.getElementById('lang');
      return {
        brandText: brand ? brand.textContent.trim() : null,
        navLinks,
        hasThemeBtn: !!themeBtn,
        hasLangBtn: !!langBtn
      };
    })()`);
    assert('Header has 4 nav links', headerInfo.navLinks.length === 4, JSON.stringify(headerInfo));
    assert('Header has theme and language buttons', headerInfo.hasThemeBtn && headerInfo.hasLangBtn);

    // 2. Dual Themes (Light & Dark)
    console.log('\n--- Testing Theme Toggle ---');
    const initialTheme = await evalExpr(send, `document.documentElement.getAttribute('data-theme')`);
    await evalExpr(send, `document.getElementById('theme').click()`);
    await sleep(300);
    const toggledTheme = await evalExpr(send, `document.documentElement.getAttribute('data-theme')`);
    assert('Theme toggles from ' + initialTheme + ' to different theme', initialTheme !== toggledTheme, `toggled: ${toggledTheme}`);
    const storedTheme = await evalExpr(send, `localStorage.getItem('wn-theme')`);
    assert('Theme persisted in localStorage', storedTheme === toggledTheme);

    // Switch back to light for consistency
    if (toggledTheme === 'dark') {
      await evalExpr(send, `document.getElementById('theme').click()`);
      await sleep(300);
    }

    // 3. Language Toggle (EN <-> AM)
    console.log('\n--- Testing Language Toggle ---');
    const initialLang = await evalExpr(send, `document.documentElement.lang`);
    await evalExpr(send, `document.getElementById('lang').click()`);
    await sleep(400);
    const amLang = await evalExpr(send, `document.documentElement.lang`);
    assert('Language toggles to Amharic (am)', amLang === 'am', `lang was: ${amLang}`);
    const amNav = await evalExpr(send, `Array.from(document.querySelectorAll('nav a')).map(a => a.textContent.trim())`);
    console.log('Amharic nav links:', amNav);
    // Check Amharic translation
    assert('Nav links translated to Amharic', amNav.some(l => l.includes('ማረጋገጥ') || l.includes('አሰራር') || l.includes('ሰነድ')), `Links: ${JSON.stringify(amNav)}`);

    // Toggle back to English
    await evalExpr(send, `document.getElementById('lang').click()`);
    await sleep(400);
    const enLang = await evalExpr(send, `document.documentElement.lang`);
    assert('Language toggles back to English', enLang === 'en');

    // Helper injected into page for setting React controlled values
    await evalExpr(send, `window.__setVal = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const proto = el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }`);

    // 4. Registration Form Validation Order on Issue Page
    console.log('\n--- Testing Registration Validation Order ---');
    // Ensure clean signed-out state
    await evalExpr(send, `(() => {
      localStorage.removeItem('wasenet_user');
      localStorage.removeItem('wasenet_jwt');
      window.dispatchEvent(new CustomEvent('authchange'));
    })()`);
    await sleep(200);

    await evalExpr(send, `window.location.hash = '#/issue'`);
    await sleep(500);

    // Open register mode
    await evalExpr(send, `(() => {
      const regBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create an account'));
      if (regBtn) regBtn.click();
    })()`);
    await sleep(300);

    // Check 1: Empty submit -> reg_missing ("Fill in every field.")
    await evalExpr(send, `document.querySelector('#f-register button[type="submit"]')?.click()`);
    await sleep(200);
    const err1 = await evalExpr(send, `document.getElementById('e-reg')?.textContent || ''`);
    assert('Empty submit gives "Fill in every field."', err1 === 'Fill in every field.', `Got: ${err1}`);

    // Check 2: Fill fields but short password -> reg_short ("Password must be at least 8 characters.")
    await evalExpr(send, `(() => {
      window.__setVal('#f-register [name="name"]', 'Test Admin');
      window.__setVal('#f-register [name="org"]', 'Land Bureau');
      window.__setVal('#f-register [name="role"]', 'admin');
      window.__setVal('#f-register [name="u"]', 'admin_tester');
      window.__setVal('#f-register [name="p"]', 'short');
      window.__setVal('#f-register [name="p2"]', 'short');
      document.querySelector('#f-register button[type="submit"]')?.click();
    })()`);
    await sleep(200);
    const err2 = await evalExpr(send, `document.getElementById('e-reg')?.textContent || ''`);
    assert('Short password gives "Password must be at least 8 characters."', err2 === 'Password must be at least 8 characters.', `Got: ${err2}`);

    // Check 3: Passwords do not match -> reg_mismatch ("The passwords do not match.")
    await evalExpr(send, `(() => {
      window.__setVal('#f-register [name="p"]', 'password123');
      window.__setVal('#f-register [name="p2"]', 'password456');
      document.querySelector('#f-register button[type="submit"]')?.click();
    })()`);
    await sleep(200);
    const err3 = await evalExpr(send, `document.getElementById('e-reg')?.textContent || ''`);
    assert('Mismatch password gives "The passwords do not match."', err3 === 'The passwords do not match.', `Got: ${err3}`);

    // Check 4: Valid registration signs in and shows issue form
    await evalExpr(send, `(() => {
      window.__setVal('#f-register [name="p2"]', 'password123');
      document.querySelector('#f-register button[type="submit"]')?.click();
    })()`);
    await sleep(500);
    const hasIssueForm = await evalExpr(send, `!!document.getElementById('f-issue')`);
    assert('Valid registration signs in and displays Issue Form', hasIssueForm);

    // 5. Result Page State Banners & Details Guard
    console.log('\n--- Testing Result Page States & Details Guard ---');

    // State: Valid -> Details visible, note hidden
    await evalExpr(send, `window.location.hash = '#/result?s=valid'`);
    await sleep(400);
    const validState = await evalExpr(send, `(() => {
      const banner = document.querySelector('.banner');
      const details = document.querySelector('.card .rows');
      const note = document.querySelector('.note');
      return {
        statusAttr: banner ? banner.getAttribute('data-s') : null,
        hasDetails: !!details,
        hasNote: !!note
      };
    })()`);
    assert('Valid result has data-s="valid"', validState.statusAttr === 'valid');
    assert('Valid result shows details card', validState.hasDetails);
    assert('Valid result does NOT show dashed note', !validState.hasNote);

    // State: Tampered -> Details hidden, dashed note visible
    await evalExpr(send, `window.location.hash = '#/result?s=tampered'`);
    await sleep(400);
    const tamperedState = await evalExpr(send, `(() => {
      const banner = document.querySelector('.banner');
      const details = document.querySelector('.card .rows');
      const note = document.querySelector('.note');
      return {
        statusAttr: banner ? banner.getAttribute('data-s') : null,
        hasDetails: !!details,
        hasNote: !!note,
        noteText: note ? note.textContent.trim() : null
      };
    })()`);
    assert('Tampered result has data-s="tampered"', tamperedState.statusAttr === 'tampered');
    assert('Tampered result HIDES details card', !tamperedState.hasDetails);
    assert('Tampered result shows dashed note', tamperedState.hasNote, tamperedState.noteText);

    // State: Revoked -> Details visible
    await evalExpr(send, `window.location.hash = '#/result?s=revoked'`);
    await sleep(400);
    const revokedState = await evalExpr(send, `(() => {
      const banner = document.querySelector('.banner');
      const details = document.querySelector('.card .rows');
      return {
        statusAttr: banner ? banner.getAttribute('data-s') : null,
        hasDetails: !!details
      };
    })()`);
    assert('Revoked result has data-s="revoked" and shows details card', revokedState.statusAttr === 'revoked' && revokedState.hasDetails);

    // 6. Admin Tabs & Offline Simulation
    console.log('\n--- Testing Admin Tabs & Offline Simulation ---');
    await evalExpr(send, `window.location.hash = '#/admin/sync'`);
    await sleep(500);

    const syncTabActive = await evalExpr(send, `document.querySelector('nav.tabs a[aria-current="page"]')?.textContent`);
    assert('Admin Sync tab is active', Boolean(syncTabActive && (syncTabActive.includes('Sync') || syncTabActive.includes('ማመሳሰል'))), `Active was: ${syncTabActive}`);

    // Check footer before offline simulation
    const footerOnlineBefore = await evalExpr(send, `(() => {
      const dot = document.querySelector('#foot .dot');
      const text = document.querySelector('#foot')?.textContent;
      return { isOff: dot ? dot.classList.contains('off') : null, text };
    })()`);
    assert('Footer is online before offline simulation', !footerOnlineBefore.isOff && footerOnlineBefore.text.includes('Online'));

    // Check simulate offline
    await evalExpr(send, `(() => {
      const chk = document.getElementById('offline');
      if (chk && !chk.checked) chk.click();
    })()`);
    await sleep(400);

    const footerOfflineAfter = await evalExpr(send, `(() => {
      const dot = document.querySelector('#foot .dot');
      const text = document.querySelector('#foot')?.textContent;
      const syncBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sync now'));
      return {
        isOff: dot ? dot.classList.contains('off') : null,
        text,
        syncDisabled: syncBtn ? syncBtn.disabled : null
      };
    })()`);
    assert('Footer dot turned off when simulated offline', footerOfflineAfter.isOff, `dot.classList: ${footerOfflineAfter.isOff}`);
    assert('Footer text says Offline', footerOfflineAfter.text.includes('Offline'), `Text: ${footerOfflineAfter.text}`);
    assert('Sync now button is disabled when offline', footerOfflineAfter.syncDisabled, `syncDisabled: ${footerOfflineAfter.syncDisabled}`);

    // Uncheck simulate offline
    await evalExpr(send, `(() => {
      const chk = document.getElementById('offline');
      if (chk && chk.checked) chk.click();
    })()`);
    await sleep(400);

    // Test tab navigation: Queue, Audit, Keys, Revoke, Issuers
    for (const tab of ['queue', 'audit', 'keys', 'revoke', 'issuers']) {
      await evalExpr(send, `window.location.hash = '#/admin/${tab}'`);
      await sleep(300);
      const active = await evalExpr(send, `document.querySelector('nav.tabs a[aria-current="page"]')?.getAttribute('href')`);
      assert(`Tab #${tab} switches active tab`, active === `#/admin/${tab}`, `Active was: ${active}`);
    }

    // 7. Responsive Viewport Checks (360px, 720px, 1080px)
    console.log('\n--- Testing Responsive Viewports ---');
    const viewports = [
      { name: '360px Mobile', width: 360, height: 740 },
      { name: '720px Tablet', width: 720, height: 1024 },
      { name: '1080px Desktop', width: 1080, height: 800 }
    ];

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 600
      });

      await evalExpr(send, `window.location.hash = '#/'`);
      await sleep(300);

      const overflow = await evalExpr(send, `document.documentElement.scrollWidth > window.innerWidth`);
      assert(`${vp.name} on Home has no horizontal scroll`, !overflow);

      await evalExpr(send, `window.location.hash = '#/admin/audit'`);
      await sleep(300);
      const adminOverflow = await evalExpr(send, `document.documentElement.scrollWidth > window.innerWidth`);
      assert(`${vp.name} on Admin has no page horizontal scroll (tables scroll within .tbl-wrap)`, !adminOverflow);

      // Capture screenshot artifact for verification
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const imgPath = path.join(ARTIFACT_DIR, `responsive-${vp.width}px-verified.png`);
      fs.writeFileSync(imgPath, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: ${imgPath}`);
    }

    // 8. Capture Amharic Dark & Light Screenshots
    console.log('\n--- Capturing Theme & Language Artifacts ---');
    // Dark theme Amharic
    await evalExpr(send, `(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('wn-theme', 'dark');
      document.documentElement.lang = 'am';
      localStorage.setItem('wn-lang', 'am');
      window.location.hash = '#/';
    })()`);
    await sleep(500);
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-dark-home.png'), Buffer.from(shot.data, 'base64'));

    // Dark theme Result
    await evalExpr(send, `window.location.hash = '#/result?s=valid'`);
    await sleep(500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'amharic-dark-result.png'), Buffer.from(shot.data, 'base64'));

    // Light theme English Result
    await evalExpr(send, `(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('wn-theme', 'light');
      document.documentElement.lang = 'en';
      localStorage.setItem('wn-lang', 'en');
      window.location.hash = '#/result?s=tampered';
    })()`);
    await sleep(500);
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'english-light-result-tampered.png'), Buffer.from(shot.data, 'base64'));

    console.log('\n--- Checking Console Errors ---');
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

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
