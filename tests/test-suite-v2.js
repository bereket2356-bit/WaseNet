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

    async function waitForSelector(selector, timeout = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const found = await evalExpr(send, `Boolean(document.querySelector('${selector}'))`);
        if (found) return true;
        await sleep(150);
      }
      return false;
    }

    // 1. Initial Load & Header Navigation
    console.log('\n--- 1. Testing Header Navigation & Language Removal ---');
    await send('Page.navigate', { url: BASE_URL + '/#/' });
    await waitForSelector('#foot');
    await waitForSelector('nav a');
    await sleep(300);

    const docTitle = await evalExpr(send, `document.title`);
    assert('Home page loads with title WaseNet', docTitle === 'WaseNet', `Title was: ${docTitle}`);

    const headerInfo = await evalExpr(send, `(() => {
      const brand = document.querySelector('.brand');
      const navLinks = Array.from(document.querySelectorAll('nav a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href')
      }));
      const themeBtn = document.getElementById('theme');
      const langBtn = document.getElementById('lang');
      const reportBtn = document.getElementById('header-report-btn');
      let reportBtnStyle = null;
      if (reportBtn) {
        const cs = window.getComputedStyle(reportBtn);
        const rect = reportBtn.getBoundingClientRect();
        reportBtnStyle = {
          height: rect.height,
          border: cs.border,
          color: cs.color
        };
      }
      return {
        brandText: brand ? brand.textContent.trim() : null,
        navLinks,
        hasThemeBtn: !!themeBtn,
        hasLangBtn: !!langBtn,
        hasReportBtn: !!reportBtn,
        reportBtnStyle
      };
    })()`) || {};

    assert('Header navigation contains strictly 3 links', headerInfo.navLinks?.length === 3, `Found: ${JSON.stringify(headerInfo.navLinks)}`);
    assert('Header navigation has Verify, How it works, and Issue',
      headerInfo.navLinks?.some(l => l.href === '#/verify' && l.text === 'Verify') &&
      headerInfo.navLinks?.some(l => l.href === '#/how' && l.text === 'How it works') &&
      headerInfo.navLinks?.some(l => l.href === '#/issue' && l.text === 'Issue')
    );
    assert('Header does NOT contain language button', !headerInfo.hasLangBtn);
    assert('Header tools contains "Report a fraud" button', headerInfo.hasReportBtn);
    assert('Header "Report a fraud" button is at least 44px tall',
      headerInfo.reportBtnStyle && headerInfo.reportBtnStyle.height >= 44,
      `Height was: ${headerInfo.reportBtnStyle?.height}`
    );

    // 2. Footer Links (Report a fraud and Contact)
    console.log('\n--- 2. Testing Footer Links ---');
    const footerInfo = await evalExpr(send, `(() => {
      const foot = document.getElementById('foot');
      if (!foot) return [];
      const links = Array.from(foot.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href')
      }));
      return links;
    })()`) || [];
    assert('Footer contains Report a fraud (#/report)', footerInfo.some(l => l.href === '#/report' && l.text === 'Report a fraud'));
    assert('Footer contains Contact us (#/contact)', footerInfo.some(l => l.href === '#/contact' && l.text === 'Contact us'));

    // 3. Landing Page Closing Band
    console.log('\n--- 3. Testing Landing Page Closing Band ---');
    const closeBandButtons = await evalExpr(send, `(() => {
      const closeSection = document.querySelector('.section.close');
      if (!closeSection) return [];
      return Array.from(closeSection.querySelectorAll('.row-btns a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href')
      }));
    })()`);
    assert('Closing band contains 2 buttons', closeBandButtons.length === 2, `Found: ${JSON.stringify(closeBandButtons)}`);
    assert('Closing band contains Start scanning (#/verify)', closeBandButtons.some(b => b.href === '#/verify' && b.text === 'Start scanning'));
    assert('Closing band contains Contact us (#/contact)', closeBandButtons.some(b => b.href === '#/contact' && b.text === 'Contact us'));

    // 4. Result Page Action Buttons (Rules for Report & Contact)
    console.log('\n--- 4. Testing Result Page Action Buttons ---');
    
    // Tampered: must show Report a fraud (danger outline), must NOT show Contact us
    await evalExpr(send, `window.location.hash = '#/result?s=tampered'`);
    await sleep(400);
    const tamperedBtns = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.row-btns a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        classes: a.className
      }));
      return btns;
    })()`);
    assert('Tampered result shows Report a fraud button with danger outline',
      tamperedBtns.some(b => b.href.includes('report') && b.classes.includes('outline') && b.classes.includes('danger'))
    );
    assert('Tampered result does NOT show Contact us button',
      !tamperedBtns.some(b => b.href.includes('contact'))
    );

    // Revoked: must show Report a fraud (danger outline), must NOT show Contact us
    await evalExpr(send, `window.location.hash = '#/result?s=revoked'`);
    await sleep(400);
    const revokedBtns = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.row-btns a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        classes: a.className
      }));
      return btns;
    })()`);
    assert('Revoked result shows Report a fraud button',
      revokedBtns.some(b => b.href.includes('report') && b.classes.includes('outline') && b.classes.includes('danger'))
    );
    assert('Revoked result does NOT show Contact us button',
      !revokedBtns.some(b => b.href.includes('contact'))
    );

    // Error (unreadable): must show Contact us (outline), must NOT show Report a fraud
    await evalExpr(send, `window.location.hash = '#/result?s=error'`);
    await sleep(400);
    const errorBtns = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.row-btns a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        classes: a.className
      }));
      return btns;
    })()`);
    assert('Error result shows Contact us button with outline',
      errorBtns.some(b => b.href.includes('contact') && b.classes.includes('outline'))
    );
    assert('Error result does NOT show Report a fraud button',
      !errorBtns.some(b => b.href.includes('report'))
    );

    // Valid: must show neither Report nor Contact
    await evalExpr(send, `window.location.hash = '#/result?s=valid'`);
    await sleep(400);
    const validBtns = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.row-btns a')).map(a => a.getAttribute('href'));
      return btns;
    })()`);
    assert('Valid result shows neither Report nor Contact button',
      !validBtns.some(href => href.includes('report') || href.includes('contact'))
    );

    // Expired: must show neither Report nor Contact
    await evalExpr(send, `window.location.hash = '#/result?s=expired'`);
    await sleep(400);
    const expiredBtns = await evalExpr(send, `(() => {
      const btns = Array.from(document.querySelectorAll('.row-btns a')).map(a => a.getAttribute('href'));
      return btns;
    })()`);
    assert('Expired result shows neither Report nor Contact button',
      !expiredBtns.some(href => href.includes('report') || href.includes('contact'))
    );

    // Helper injected into page for setting React controlled values
    await evalExpr(send, `window.__setVal = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const proto = el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype
                  : el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }`);

    // 5. Fraud Report Page (#/report)
    console.log('\n--- 5. Testing Fraud Report Form Page & INSA Integration ---');
    await evalExpr(send, `window.location.hash = '#/report?docid=TEST-DOC-12345'`);
    await sleep(400);

    const reportTitle = await evalExpr(send, `document.title`);
    assert('Report page document title is set', reportTitle.includes('Report a fraud'), `Title: ${reportTitle}`);

    const prefilledDocId = await evalExpr(send, `document.querySelector('#f-report [name="docId"]')?.value`);
    assert('Document ID is pre-filled from URL query param docid', prefilledDocId === 'TEST-DOC-12345', `Value: ${prefilledDocId}`);

    // Check INSA note & links
    const insaNoteInfo = await evalExpr(send, `(() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel')
      }));
      return links;
    })()`);
    assert('Report page contains INSA Fraud Prevention Service link opening in new tab',
      insaNoteInfo.some(l => l.href === 'https://www.insa.gov.et/service/Fraud-Prevention-Service' && l.target === '_blank' && l.rel && l.rel.includes('noopener'))
    );
    assert('Report page contains INSA mailto link',
      insaNoteInfo.some(l => l.href === 'mailto:contact@insa.gov.et')
    );

    // Empty validation test
    await evalExpr(send, `(() => {
      window.__setVal('#f-report [name="docId"]', '');
      window.__setVal('#f-report [name="reason"]', '');
      document.querySelector('#f-report button[type="submit"]')?.click();
    })()`);
    await sleep(200);

    const fieldErrors = await evalExpr(send, `(() => {
      return Array.from(document.querySelectorAll('.field-err')).map(e => e.textContent.trim());
    })()`);
    assert('Validation errors match exact specification: "Enter the document ID." and "Choose what you saw."',
      fieldErrors.some(e => e === 'Enter the document ID.') &&
      fieldErrors.some(e => e === 'Choose what you saw.')
    );

    // Live character counter test
    await evalExpr(send, `window.__setVal('#f-report [name="description"]', 'Manipulated signature.')`);
    await sleep(150);
    const counterText = await evalExpr(send, `document.querySelector('.char-count')?.textContent.trim()`);
    assert('Character counter updates live', counterText.includes('22 / 500 characters'));

    // Valid submission test
    await evalExpr(send, `(() => {
      window.__setVal('#f-report [name="docId"]', 'TEST-DOC-VALID');
      window.__setVal('#f-report [name="reason"]', 'Document looks forged');
      window.__setVal('#f-report [name="description"]', 'Manipulated signature & seal.');
      window.__setVal('#f-report [name="contactDetails"]', 'officer@example.org');
      document.querySelector('#f-report button[type="submit"]')?.click();
    })()`);
    await sleep(300);

    const successInfo = await evalExpr(send, `(() => {
      const card = document.querySelector('.card');
      const text = card ? card.textContent : '';
      const emailBtn = document.querySelector('a.btn.outline[href^="mailto:"]');
      const insaBtn = document.querySelector('a.btn.outline[href="https://www.insa.gov.et/service/Fraud-Prevention-Service"]');
      const backBtn = document.querySelector('.row-btns a[href="#/verify"]');
      const contactBtn = document.querySelector('.row-btns a[href="#/contact"]');
      return {
        text,
        emailHref: emailBtn ? emailBtn.getAttribute('href') : null,
        hasInsaBtn: !!insaBtn,
        hasBackBtn: !!backBtn,
        hasContactBtn: !!contactBtn
      };
    })()`);
    assert('Submission shows "Report received" heading', successInfo.text.includes('Report received'));
    assert('Submission generates FR- reference code', /Reference:\s*FR-[A-Z0-9]{8}/.test(successInfo.text), `Text: ${successInfo.text}`);
    assert('Submission includes line explaining report goes to INSA', successInfo.text.includes('Your report is routed to INSA for review.'));
    assert('Success screen has mailto link to INSA with encoded subject & body',
      successInfo.emailHref &&
      successInfo.emailHref.startsWith('mailto:contact@insa.gov.et?subject=Fraud%20report%20FR-') &&
      successInfo.emailHref.includes('TEST-DOC-VALID') &&
      successInfo.emailHref.includes('Document%20looks%20forged')
    );
    assert('Success screen has outlined INSA service button', successInfo.hasInsaBtn);
    assert('Success screen has Back to scanning and Contact us buttons', successInfo.hasBackBtn && successInfo.hasContactBtn);

    // 6. Contact Page (#/contact)
    console.log('\n--- 6. Testing Contact Page ---');
    await evalExpr(send, `window.location.hash = '#/contact'`);
    await sleep(400);

    const contactTitle = await evalExpr(send, `document.title`);
    assert('Contact page document title is set', contactTitle.includes('Contact us'), `Title: ${contactTitle}`);

    const contactCards = await evalExpr(send, `(() => {
      const cards = Array.from(document.querySelectorAll('.stack .card'));
      return cards.map(c => ({
        title: c.querySelector('h2')?.textContent.trim(),
        text: c.textContent.trim(),
        links: Array.from(c.querySelectorAll('a')).map(a => a.getAttribute('href'))
      }));
    })()`);
    assert('Contact page renders 4 cards', contactCards.length === 4, `Count: ${contactCards.length}`);
    assert('Card 1 is INSA Fraud and identity reports with real links',
      contactCards[0].title.includes('Fraud and identity reports') &&
      contactCards[0].links.includes('https://www.insa.gov.et/service/Fraud-Prevention-Service') &&
      contactCards[0].links.includes('mailto:contact@insa.gov.et')
    );
    assert('Card 2 is WaseNet support phone with tel link',
      contactCards[1].links.includes('tel:+251000000000')
    );
    assert('Card 3 is WaseNet support email with mailto link',
      contactCards[2].links.includes('mailto:support@example.org')
    );
    assert('Card 4 is Office hours', contactCards[3].title.includes('Office hours'));

    const contactReportBtn = await evalExpr(send, `(() => {
      const btn = document.querySelector('a.btn.outline.danger[href="#/report"]');
      return btn ? btn.textContent.trim() : null;
    })()`);
    assert('Contact page has Report a fraud link button at bottom', contactReportBtn && contactReportBtn === 'Report a fraud');

    // 7. Relocated Admin Capabilities
    console.log('\n--- 7. Testing Relocated Features (Pending & sync and Revoke on Issue) ---');
    
    // Ensure officer is signed in for Issue and Verify audit log
    await evalExpr(send, `(() => {
      localStorage.setItem('wasenet_user', JSON.stringify({
        id: 'u-admin-1',
        name: 'Authorized Officer',
        org: 'Bureau of Authenticity',
        role: 'admin',
        username: 'officer1'
      }));
      window.dispatchEvent(new CustomEvent('authchange'));
    })()`);
    await sleep(300);

    // Test Issue Page: Pending and sync card + Revocation card
    await evalExpr(send, `window.location.hash = '#/issue'`);
    await sleep(500);

    const issuePageSections = await evalExpr(send, `(() => {
      const headings = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
      const offlineChk = document.getElementById('offline');
      const syncBtn = document.querySelector('button[data-act="sync"]');
      const revokeForm = document.getElementById('f-revoke');
      return {
        headings,
        hasOfflineChk: !!offlineChk,
        hasSyncBtn: !!syncBtn,
        hasRevokeForm: !!revokeForm
      };
    })()`);
    assert('Issue page includes "Pending and sync" section', issuePageSections.headings.some(h => h.includes('Pending and sync')));
    assert('Issue page includes "Revoke a document" section', issuePageSections.headings.some(h => h.includes('Revoke a document')));
    assert('Issue page contains offline simulation toggle', issuePageSections.hasOfflineChk);

    // Test Offline simulation on Issue page
    await evalExpr(send, `(() => {
      const chk = document.getElementById('offline');
      if (chk && !chk.checked) chk.click();
    })()`);
    await sleep(400);

    const offlineStatus = await evalExpr(send, `(() => {
      const dot = document.querySelector('#foot .dot');
      const text = document.querySelector('#foot')?.textContent;
      const syncBtn = document.querySelector('button[data-act="sync"]');
      return {
        isDotOff: dot ? dot.classList.contains('off') : false,
        text,
        isSyncDisabled: syncBtn ? syncBtn.disabled : false
      };
    })()`);
    assert('Offline toggle turns footer dot red/off', offlineStatus.isDotOff);
    assert('Offline toggle changes footer text to Offline', offlineStatus.text.includes('Offline'));
    assert('Sync now button is disabled when offline', offlineStatus.isSyncDisabled);

    // Restore online
    await evalExpr(send, `(() => {
      const chk = document.getElementById('offline');
      if (chk && chk.checked) chk.click();
    })()`);
    await sleep(300);

    // Test Verify Page: Recent checks section for signed-in officer
    await evalExpr(send, `window.location.hash = '#/verify'`);
    await sleep(500);

    const recentChecksSection = await evalExpr(send, `(() => {
      const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
      const filter = document.getElementById('filter');
      return {
        hasRecentChecks: h2s.some(h => h.includes('Recent checks')),
        hasFilter: !!filter
      };
    })()`);
    assert('Verify page displays "Recent checks" section when signed in', recentChecksSection.hasRecentChecks);
    assert('Verify page has filter for audit history', recentChecksSection.hasFilter);

    // Test Admin route redirection
    await evalExpr(send, `window.location.hash = '#/admin'`);
    await sleep(400);
    const adminRedirectHash = await evalExpr(send, `window.location.hash`);
    assert('Accessing #/admin is safely redirected to #/issue', adminRedirectHash === '#/issue', `Hash: ${adminRedirectHash}`);

    // 8. Theme Toggle Verification
    console.log('\n--- 8. Testing Theme Toggle ---');
    const initialTheme = await evalExpr(send, `document.documentElement.getAttribute('data-theme')`);
    await evalExpr(send, `document.getElementById('theme').click()`);
    await sleep(300);
    const toggledTheme = await evalExpr(send, `document.documentElement.getAttribute('data-theme')`);
    assert('Theme toggles to opposite theme', initialTheme !== toggledTheme);
    const storedTheme = await evalExpr(send, `localStorage.getItem('wn-theme')`);
    assert('Theme persisted in localStorage', storedTheme === toggledTheme);

    // Restore light
    if (toggledTheme === 'dark') {
      await evalExpr(send, `document.getElementById('theme').click()`);
      await sleep(300);
    }

    // 9. Responsive Viewports (360px, 720px, 1080px)
    console.log('\n--- 9. Testing Responsive Viewports ---');
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

      for (const testRoute of ['#/', '#/report', '#/contact', '#/issue', '#/verify']) {
        await evalExpr(send, `window.location.hash = '${testRoute}'`);
        await sleep(250);
        const overflow = await evalExpr(send, `document.documentElement.scrollWidth > window.innerWidth`);
        assert(`${vp.name} on ${testRoute} has no horizontal scroll`, !overflow);
      }

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, `responsive-${vp.width}px-verified.png`), Buffer.from(shot.data, 'base64'));
    }

    // 10. Testing Prompt Specific Requirements: Glassy Header, Form Centering & Action Alignments
    console.log('\n--- 10. Testing Specific Requirements (Header Blur, Form Centering, Action Spacing) ---');

    // 10.1 Glassy Header tests
    await evalExpr(send, `window.location.hash = '#/'`);
    await sleep(300);

    const headerGlassyInfoLight = await evalExpr(send, `(() => {
      const top = document.querySelector('.top');
      const cs = window.getComputedStyle(top);
      return {
        position: cs.position,
        top: cs.top,
        zIndex: cs.zIndex,
        backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
        backgroundColor: cs.backgroundColor,
        borderBottom: cs.borderBottom
      };
    })()`);

    assert('Header has position sticky, top 0, and z-index 100',
      headerGlassyInfoLight.position === 'sticky' &&
      headerGlassyInfoLight.top === '0px' &&
      headerGlassyInfoLight.zIndex === '100'
    );
    assert('Header has backdrop-filter with blur and saturate',
      headerGlassyInfoLight.backdropFilter &&
      headerGlassyInfoLight.backdropFilter.includes('blur(14px)') &&
      (headerGlassyInfoLight.backdropFilter.includes('saturate(160%)') || headerGlassyInfoLight.backdropFilter.includes('saturate(1.6)'))
    );
    assert('Header light background is semi-transparent (~70%)',
      headerGlassyInfoLight.backgroundColor.includes('rgba(245, 246, 244, 0.7')
    );

    // Test dark theme header background
    await evalExpr(send, `document.getElementById('theme').click()`);
    await sleep(200);
    const headerGlassyInfoDark = await evalExpr(send, `(() => {
      const top = document.querySelector('.top');
      const cs = window.getComputedStyle(top);
      return {
        backgroundColor: cs.backgroundColor,
        backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter
      };
    })()`);
    assert('Header dark background is semi-transparent (~65%)',
      headerGlassyInfoDark.backgroundColor.includes('rgba(18, 26, 29, 0.65')
    );
    // Restore light theme
    await evalExpr(send, `document.getElementById('theme').click()`);
    await sleep(200);

    // Verify scroll blur on Home, How, and Verify pages
    for (const route of ['#/', '#/how', '#/verify']) {
      await evalExpr(send, `window.location.hash = '${route}'`);
      await sleep(200);
      await evalExpr(send, `window.scrollTo(0, 300)`);
      await sleep(100);
      const scrollPos = await evalExpr(send, `window.scrollY`);
      const topRect = await evalExpr(send, `document.querySelector('.top').getBoundingClientRect().top`);
      assert(`Header remains fixed at top 0 while scrolling on ${route}`, topRect === 0 && scrollPos > 0);
      await evalExpr(send, `window.scrollTo(0, 0)`);
    }

    // 10.2 Issue Page signed-out centered card tests
    await evalExpr(send, `(() => {
      localStorage.removeItem('wasenet_user');
      window.dispatchEvent(new CustomEvent('authchange'));
    })()`);
    await evalExpr(send, `window.location.hash = '#/issue'`);
    await sleep(300);

    // Desktop viewport (1080px)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1080,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(200);

    const desktopIssueAuth = await evalExpr(send, `(() => {
      const stage = document.querySelector('.auth-stage');
      const card = stage ? stage.querySelector('.card.narrow') : null;
      if (!stage || !card) return null;
      const stageRect = stage.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const csCard = window.getComputedStyle(card);
      return {
        stageHeight: stageRect.height,
        cardWidth: cardRect.width,
        cardMaxWidth: csCard.maxWidth,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        stageTop: stageRect.top,
        stageBottom: stageRect.bottom,
        isVerticallyCentered: Math.abs((cardRect.top - stageRect.top) - (stageRect.bottom - cardRect.bottom)) < 40
      };
    })()`);

    assert('Issue page signed-out card is centered vertically on desktop',
      desktopIssueAuth && desktopIssueAuth.isVerticallyCentered,
      JSON.stringify(desktopIssueAuth)
    );
    assert('Issue page signed-out card max-width is 460px',
      desktopIssueAuth && desktopIssueAuth.cardMaxWidth === '460px'
    );

    // Mobile viewport (360px)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 1,
      mobile: true
    });
    await sleep(200);

    const mobileIssueAuth = await evalExpr(send, `(() => {
      const stage = document.querySelector('.auth-stage');
      const card = stage ? stage.querySelector('.card.narrow') : null;
      if (!stage || !card) return null;
      const cardRect = card.getBoundingClientRect();
      return {
        cardWidth: cardRect.width,
        cardLeft: cardRect.left,
        cardRight: window.innerWidth - cardRect.right,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);

    assert('Issue page signed-out card fits 360px phone with no overflow',
      mobileIssueAuth && !mobileIssueAuth.hasOverflow && mobileIssueAuth.cardWidth <= 360
    );
    assert('Issue page signed-out card is centered horizontally on 360px phone',
      mobileIssueAuth && Math.abs(mobileIssueAuth.cardLeft - mobileIssueAuth.cardRight) <= 2
    );

    // Reset back to desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1080,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(200);

    // 10.3 Page Intro & Action Button consistency
    const introPages = [
      { route: '#/', expectedHeading: 'Verify a document in one scan.' },
      { route: '#/how', expectedHeading: 'How WaseNet works' },
      { route: '#/verify', expectedHeading: 'Scan a document' },
      { route: '#/report', expectedHeading: 'Report a fraud' }
    ];

    for (const ip of introPages) {
      await evalExpr(send, `window.location.hash = '${ip.route}'`);
      await sleep(250);

      const introStyle = await evalExpr(send, `(() => {
        const intro = document.querySelector('.page-intro');
        if (!intro) return null;
        const h1 = intro.querySelector('h1');
        const p = intro.querySelector('p');
        const csIntro = window.getComputedStyle(intro);
        const csH1 = h1 ? window.getComputedStyle(h1) : null;
        const csP = p ? window.getComputedStyle(p) : null;
        return {
          textAlign: csIntro.textAlign,
          paddingTop: csIntro.paddingTop,
          paddingBottom: csIntro.paddingBottom,
          h1Heading: h1?.textContent.trim(),
          h1MarginBottom: csH1?.marginBottom,
          pMarginTop: csP?.marginTop,
          pMaxWidth: csP?.maxWidth
        };
      })()`);

      assert(`.page-intro on ${ip.route} has text-align center, 40px top padding, 24px bottom padding`,
        introStyle && introStyle.textAlign === 'center' &&
        introStyle.paddingTop === '40px' && introStyle.paddingBottom === '24px'
      );
      assert(`.page-intro heading on ${ip.route} has 12px margin-bottom`,
        introStyle && introStyle.h1MarginBottom === '12px'
      );
      assert(`.page-intro intro on ${ip.route} has 0px margin-top and ~52ch max-width`,
        introStyle && introStyle.pMarginTop === '0px' &&
        parseFloat(introStyle.pMaxWidth) >= 350 && parseFloat(introStyle.pMaxWidth) <= 650,
        JSON.stringify(introStyle)
      );
    }

    // Action button sizes: Primary 52px / 24px padding, Secondary 44px / 24px padding
    // Home "Scan a document"
    await evalExpr(send, `window.location.hash = '#/'`);
    await sleep(200);
    const homeScanBtn = await evalExpr(send, `(() => {
      const btn = document.querySelector('.page-intro .row-btns .btn');
      const rect = btn.getBoundingClientRect();
      const cs = window.getComputedStyle(btn);
      return { height: Math.round(rect.height), paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    })()`);
    assert('Home "Scan a document" button is 52px tall with 24px horizontal padding',
      homeScanBtn && homeScanBtn.height === 52 && homeScanBtn.paddingLeft === '24px' && homeScanBtn.paddingRight === '24px'
    );

    // Verify "Scan a document"
    await evalExpr(send, `window.location.hash = '#/verify'`);
    await sleep(200);
    const verifyScanBtn = await evalExpr(send, `(() => {
      const btn = document.querySelector('.scan-btn');
      const rect = btn.getBoundingClientRect();
      const cs = window.getComputedStyle(btn);
      return { height: Math.round(rect.height), paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    })()`);
    assert('Verify page "Scan a document" button is 52px tall with 24px horizontal padding',
      verifyScanBtn && verifyScanBtn.height === 52 && verifyScanBtn.paddingLeft === '24px' && verifyScanBtn.paddingRight === '24px'
    );

    // Header "Report a fraud" (secondary: 44px / 24px padding)
    const headerReportBtn = await evalExpr(send, `(() => {
      const btn = document.getElementById('header-report-btn');
      const rect = btn.getBoundingClientRect();
      const cs = window.getComputedStyle(btn);
      return { height: Math.round(rect.height), paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    })()`);
    assert('Header "Report a fraud" secondary button is 44px tall with 24px horizontal padding',
      headerReportBtn && headerReportBtn.height === 44 && headerReportBtn.paddingLeft === '24px' && headerReportBtn.paddingRight === '24px'
    );

    // Result page "Report a fraud" (primary action button: 52px / 24px padding)
    await evalExpr(send, `window.location.hash = '#/result?s=tampered'`);
    await sleep(200);
    const resultReportBtn = await evalExpr(send, `(() => {
      const btn = document.querySelector('.row-btns a[href*="report"]');
      const rect = btn.getBoundingClientRect();
      const cs = window.getComputedStyle(btn);
      return { height: Math.round(rect.height), paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    })()`);
    assert('Result page "Report a fraud" button is 52px tall with 24px horizontal padding',
      resultReportBtn && resultReportBtn.height === 52 && resultReportBtn.paddingLeft === '24px' && resultReportBtn.paddingRight === '24px'
    );

    console.log('\n--- 11. Checking Console Errors ---');
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
