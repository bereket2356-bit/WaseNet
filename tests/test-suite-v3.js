import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9266;
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

async function runTestSuite() {
  console.log('--- STARTING COMPREHENSIVE WASENET V3 TEST SUITE ---');
  const tmpProfile = path.join(process.cwd(), '.chrome-tmp-test-profile-v3');

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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width <= 768
      });
      await sleep(150);
    }

    // Warm up
    await send('Page.navigate', { url: BASE_URL + '/#/' });
    await sleep(1000);

    // 1. Check meta tags in head
    console.log('\n--- 1. Testing Head Meta Tags ---');
    const metaCheck = await evalExpr(send, `(() => {
      const colorScheme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');
      const themeLight = document.querySelector('meta[name="theme-color"][media*="light"]')?.getAttribute('content');
      const themeDark = document.querySelector('meta[name="theme-color"][media*="dark"]')?.getAttribute('content');
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
      return { colorScheme, themeLight, themeDark, viewport };
    })()`);
    assert('meta color-scheme is light dark', metaCheck.colorScheme === 'light dark', JSON.stringify(metaCheck));
    assert('meta theme-color light is #F5F6F4', metaCheck.themeLight === '#F5F6F4', JSON.stringify(metaCheck));
    assert('meta theme-color dark is #121A1D', metaCheck.themeDark === '#121A1D', JSON.stringify(metaCheck));
    assert('meta viewport includes viewport-fit=cover', metaCheck.viewport && metaCheck.viewport.includes('viewport-fit=cover'), JSON.stringify(metaCheck));

    // 2. Type scale on Desktop
    console.log('\n--- 2. Testing Desktop Type Scale & Sizing ---');
    await setViewport(1200, 900);
    await evalExpr(send, `window.location.hash = '#/'`);
    await sleep(200);

    const bodyStyles = await evalExpr(send, `(() => {
      const cs = window.getComputedStyle(document.body);
      const htmlCs = window.getComputedStyle(document.documentElement);
      return {
        fontSize: cs.fontSize,
        lineHeight: Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 100) / 100,
        letterSpacing: cs.letterSpacing,
        textSizeAdjust: htmlCs.webkitTextSizeAdjust || htmlCs.textSizeAdjust
      };
    })()`);
    assert('Body text is 15px', bodyStyles.fontSize === '15px', JSON.stringify(bodyStyles));
    assert('Body line-height is ~1.55', Math.abs(bodyStyles.lineHeight - 1.55) < 0.05, JSON.stringify(bodyStyles));
    assert('html text-size-adjust is 100%', bodyStyles.textSizeAdjust === '100%', JSON.stringify(bodyStyles));

    const btnStyles = await evalExpr(send, `(() => {
      const btn = document.querySelector('.hero .btn');
      const cs = window.getComputedStyle(btn);
      const rect = btn.getBoundingClientRect();
      return { height: Math.round(rect.height), fontSize: cs.fontSize };
    })()`);
    assert('Primary button is 48px tall', btnStyles.height === 48, JSON.stringify(btnStyles));
    assert('Primary button text is 15px', btnStyles.fontSize === '15px', JSON.stringify(btnStyles));

    const scanBtn = await evalExpr(send, `(async () => {
      window.location.hash = '#/verify';
      await new Promise(r => setTimeout(r, 200));
      const btn = document.querySelector('.scan-btn');
      const cs = window.getComputedStyle(btn);
      const rect = btn.getBoundingClientRect();
      return { height: Math.round(rect.height), fontSize: cs.fontSize };
    })()`);
    assert('Scan button is 64px tall', scanBtn.height === 64, JSON.stringify(scanBtn));
    assert('Scan button text is 17px', scanBtn.fontSize === '17px', JSON.stringify(scanBtn));

    // 3. Form fields on Desktop
    await evalExpr(send, `window.location.hash = '#/report'`);
    await sleep(200);
    const formStyles = await evalExpr(send, `(() => {
      const input = document.querySelector('input[name="docId"]');
      const textarea = document.querySelector('textarea[name="description"]');
      const inputCs = window.getComputedStyle(input);
      const inputRect = input.getBoundingClientRect();
      const taCs = window.getComputedStyle(textarea);
      const taRect = textarea.getBoundingClientRect();
      return {
        inputHeight: Math.round(inputRect.height),
        inputRadius: inputCs.borderRadius,
        inputFont: inputCs.fontSize,
        taHeight: Math.round(taRect.height)
      };
    })()`);
    assert('Form field is at least 46px tall', formStyles && formStyles.inputHeight >= 46, JSON.stringify(formStyles));
    assert('Form field corner radius is 10px', formStyles && formStyles.inputRadius === '10px', JSON.stringify(formStyles));
    assert('Form field font size is 15px', formStyles && formStyles.inputFont === '15px', JSON.stringify(formStyles));
    assert('Textarea minimum height is at least 100px', formStyles && formStyles.taHeight >= 100, JSON.stringify(formStyles));

    // 4. Mobile Header at 360px & 412px
    console.log('\n--- 3. Testing Mobile Header (360px & 412px) ---');
    for (const width of [360, 412]) {
      await setViewport(width, 800);
      await evalExpr(send, `window.location.hash = '#/'`);
      await sleep(200);

      const headerLayout = await evalExpr(send, `(() => {
        const top = document.querySelector('.top');
        const bar = document.querySelector('.bar');
        const nav = document.querySelector('nav');
        const navLinks = Array.from(document.querySelectorAll('nav .nav-link'));
        const brand = document.querySelector('.brand');
        const tools = document.querySelector('.tools');
        const reportBtn = document.getElementById('header-report-btn');

        const barRect = bar.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const brandRect = brand.getBoundingClientRect();
        const linkRects = navLinks.map(l => {
          const r = l.getBoundingClientRect();
          const cs = window.getComputedStyle(l);
          return { width: Math.round(r.width), height: Math.round(r.height), fontSize: cs.fontSize, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight };
        });
        const reportCs = window.getComputedStyle(reportBtn);

        return {
          barMinHeight: Math.round(barRect.height),
          navTop: Math.round(navRect.top),
          brandBottom: Math.round(brandRect.bottom),
          navWidthRatio: Math.round(navRect.width / barRect.width * 100),
          linksCount: navLinks.length,
          linkRects,
          reportPaddingLeft: reportCs.paddingLeft,
          reportPaddingRight: reportCs.paddingRight
        };
      })()`);

      assert(`[${width}px] Header bar is at least 60px tall`, headerLayout.barMinHeight >= 60, JSON.stringify(headerLayout));
      assert(`[${width}px] Nav is on a second row below brand/tools`, headerLayout.navTop >= headerLayout.brandBottom, JSON.stringify(headerLayout));
      assert(`[${width}px] Nav takes full width of bar`, headerLayout.navWidthRatio >= 95, JSON.stringify(headerLayout));
      assert(`[${width}px] Nav has exactly 3 links sharing width equally`,
        headerLayout.linksCount === 3 && Math.abs(headerLayout.linkRects[0].width - headerLayout.linkRects[1].width) <= 2,
        JSON.stringify(headerLayout.linkRects)
      );
      assert(`[${width}px] Nav links are 40px tall`, headerLayout.linkRects.every(l => l.height === 40), JSON.stringify(headerLayout.linkRects));
    }

    // 5. Test Scroll Sticky Header without content overlap
    console.log('\n--- 4. Testing Sticky Header Scroll Overlap on 360px Mobile ---');
    await setViewport(360, 640);
    await evalExpr(send, `window.location.hash = '#/'`);
    await sleep(200);

    const overlapCheck = await evalExpr(send, `(() => {
      const top = document.querySelector('.top');
      const main = document.querySelector('.main-content');
      const topRect = top.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        topBottom: Math.round(topRect.bottom),
        mainTop: Math.round(mainRect.top),
        noOverlap: mainRect.top >= topRect.bottom
      };
    })()`);
    assert('Page content starts below sticky header without overlap', overlapCheck.noOverlap, JSON.stringify(overlapCheck));

    // Scroll down and test sticky header
    await evalExpr(send, `window.scrollTo(0, 300)`);
    await sleep(150);
    const scrolledTop = await evalExpr(send, `document.querySelector('.top').getBoundingClientRect().top`);
    assert('Header remains sticky at top:0 during scroll', scrolledTop === 0, `scrolledTop: ${scrolledTop}`);
    await evalExpr(send, `window.scrollTo(0, 0)`);

    // 6. Home page on 360px Mobile: Hero buttons, Cert card, Closing band
    console.log('\n--- 5. Testing Home Page at 360px ---');
    const homeMobile = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.hero .row-btns .btn'));
      const cert = document.querySelector('.cert');
      const qr = document.querySelector('.cert .qr');
      const certStatus = document.querySelector('.cert-status');
      const close = document.querySelector('.close');
      const closeCs = window.getComputedStyle(close);
      const closeRect = close.getBoundingClientRect();

      const btn1Rect = btns[0].getBoundingClientRect();
      const btn2Rect = btns[1].getBoundingClientRect();
      const qrRect = qr.getBoundingClientRect();
      const certRect = cert.getBoundingClientRect();
      const statusCs = window.getComputedStyle(certStatus);

      return {
        btnsStacked: btn2Rect.top >= btn1Rect.bottom,
        btn1FullWidth: Math.round(btn1Rect.width),
        qrWidth: Math.round(qrRect.width),
        qrHeight: Math.round(qrRect.height),
        qrLeft: Math.round(qrRect.left - certRect.left),
        closePaddingTop: closeCs.paddingTop,
        closePaddingLeft: closeCs.paddingLeft,
        statusFont: statusCs.fontSize
      };
    })()`);
    assert('Hero buttons stack vertically', homeMobile.btnsStacked, JSON.stringify(homeMobile));
    assert('Certificate QR is 88px', homeMobile.qrWidth === 88 && homeMobile.qrHeight === 88, JSON.stringify(homeMobile));
    assert('Closing band has 40px vertical & 20px horizontal padding',
      homeMobile.closePaddingTop === '40px' && homeMobile.closePaddingLeft === '20px',
      JSON.stringify(homeMobile)
    );

    // 7. Toolbars and Tables on Verify and Issue at 360px
    console.log('\n--- 6. Testing Toolbars and Tables at 360px ---');
    await evalExpr(send, `(async () => {
      // Sign in to show recent checks & pending sync
      localStorage.setItem('wasenet_user', JSON.stringify({
        username: 'officer1',
        role: 'issuer',
        office: 'Addis Office',
        exp: Math.floor(Date.now() / 1000) + 28800
      }));
      window.dispatchEvent(new CustomEvent('authchange'));
      // Directly add an audit record via storage module
      const { auditStore } = await import('/src/storage.js');
      await auditStore.addRecord('550e8400-e29b-41d4-a716-446655440000', 'VALID');
      window.location.hash = '#/verify';
    })()`);
    await sleep(400);

    const verifyToolbar = await evalExpr(send, `(() => {
      const tb = document.querySelector('.toolbar');
      if (!tb) return null;
      const cs = window.getComputedStyle(tb);
      const title = tb.querySelector('h2');
      const filter = tb.querySelector('label');
      const tRect = title.getBoundingClientRect();
      const fRect = filter.getBoundingClientRect();
      return {
        flexDirection: cs.flexDirection,
        stacked: fRect.top >= tRect.bottom
      };
    })()`);
    assert('Verify toolbar stacks vertically on 360px', verifyToolbar && verifyToolbar.stacked, JSON.stringify(verifyToolbar));

    const tableTouchScroll = await evalExpr(send, `(() => {
      const tblWrap = document.querySelector('.tbl-wrap');
      if (!tblWrap) return null;
      const cs = window.getComputedStyle(tblWrap);
      const tbl = tblWrap.querySelector('.tbl');
      const tblCs = window.getComputedStyle(tbl.querySelector('td') || tbl.querySelector('th'));
      return {
        overflowX: cs.overflowX,
        borderRadius: cs.borderRadius,
        touchScroll: cs.webkitOverflowScrolling || cs.overflowScrolling,
        cellPadding: tblCs.padding,
        cellFont: tblCs.fontSize
      };
    })()`);
    assert('Table wrapper has horizontal overflow-x and 16px radius',
      tableTouchScroll && tableTouchScroll.overflowX === 'auto' && tableTouchScroll.borderRadius === '16px',
      JSON.stringify(tableTouchScroll)
    );
    assert('Table cell text is 14px with 10px 12px padding',
      tableTouchScroll && tableTouchScroll.cellFont === '14px' && tableTouchScroll.cellPadding.includes('10px'),
      JSON.stringify(tableTouchScroll)
    );

    // 8. Result page at 360px
    console.log('\n--- 7. Testing Result Page at 360px ---');
    await evalExpr(send, `window.location.hash = '#/result?s=valid'`);
    await sleep(200);

    const resultLayout = await evalExpr(send, `(() => {
      const banner = document.querySelector('.banner');
      const card = document.querySelector('.card');
      const chips = document.querySelector('.chips');
      const bRect = banner.getBoundingClientRect();
      const cRect = card.getBoundingClientRect();
      const chRect = chips.getBoundingClientRect();
      return {
        bannerStacked: cRect.top >= bRect.bottom,
        chipsStacked: chRect.top >= cRect.bottom,
        cardFullWidth: Math.round(cRect.width),
        bannerFullWidth: Math.round(bRect.width)
      };
    })()`);
    assert('Result banner, card, and chips stay in single column',
      resultLayout.bannerStacked && resultLayout.chipsStacked,
      JSON.stringify(resultLayout)
    );

    // 9. Zero horizontal scroll across all routes at 360px, 412px, 768px, 1024px in Light & Dark
    console.log('\n--- 8. Testing Zero Horizontal Scroll Across Viewports & Themes ---');
    const routes = ['#/', '#/verify', '#/result?s=valid', '#/how', '#/issue', '#/report', '#/contact'];
    const widths = [360, 412, 768, 1024];

    for (const theme of ['light', 'dark']) {
      await evalExpr(send, `document.documentElement.setAttribute('data-theme', '${theme}')`);
      await sleep(100);

      for (const w of widths) {
        await setViewport(w, 800);
        for (const r of routes) {
          await evalExpr(send, `window.location.hash = '${r}'`);
          await sleep(100);

          const scrollWidth = await evalExpr(send, `document.documentElement.scrollWidth`);
          const clientWidth = await evalExpr(send, `document.documentElement.clientWidth`);
          const hasScroll = scrollWidth > clientWidth;

          assert(`[${theme.toUpperCase()}][${w}px] No horizontal scroll on ${r}`, !hasScroll,
            `scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`
          );
        }
      }
    }

    // 10. Check Console Errors
    console.log('\n--- 9. Checking Console Exceptions ---');
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
