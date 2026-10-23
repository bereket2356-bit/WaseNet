import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, login } from '../auth.js';
import { getSigningProvider, IsolatedMockHardwareSigningProvider } from '../signing-provider.js';
import { queueStore } from '../storage.js';
import { QrCodeGenerator } from '../qr-generator.js';

const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    }));

export default function IssuePage({ navigate }) {
  const { t, lang } = useI18n();
  const [user, setUser] = useState(getCurrentUser());
  const [authMode, setAuthMode] = useState('choose'); // 'choose' | 'register' | 'signin'
  const [regError, setRegError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [dateError, setDateError] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [issued, setIssued] = useState(null);

  const checkOffline = () => {
    return Boolean(window.__wasenet_simulated_offline || !navigator.onLine);
  };
  const [isOffline, setIsOffline] = useState(checkOffline);

  const canvasRef = useRef(null);

  // Registration form state
  const [regForm, setRegForm] = useState({
    name: '',
    org: '',
    role: 'issuer',
    u: '',
    p: '',
    p2: ''
  });

  // Sign in form state
  const [loginForm, setLoginForm] = useState({
    u: '',
    p: ''
  });

  // Issue document form state
  const today = new Date().toISOString().split('T')[0];
  const fiveYearsLater = new Date();
  fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5);
  const expiryDefault = fiveYearsLater.toISOString().split('T')[0];

  const [docForm, setDocForm] = useState({
    docId: newId(),
    docType: 'dt_land',
    holder: '',
    holderId: '',
    issued: today,
    expires: expiryDefault,
    issuer: user?.office || 'Addis Ababa Sub-city Office 04'
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const current = getCurrentUser();
      setUser(current);
      if (current && !docForm.issuer) {
        setDocForm(prev => ({ ...prev, issuer: current.office || prev.issuer }));
      }
    };

    const handleOnlineStatus = () => {
      setIsOffline(checkOffline());
    };

    window.addEventListener('authchange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('offlinesimchange', handleOnlineStatus);

    return () => {
      window.removeEventListener('authchange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('offlinesimchange', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (issued && canvasRef.current && issued.jws) {
      QrCodeGenerator.drawToCanvas(canvasRef.current, issued.jws, 240);
    }
  }, [issued]);

  // Regenerate UUID
  const regenDocId = () => {
    setDocForm(prev => ({ ...prev, docId: newId() }));
  };

  const handleDocChange = (e) => {
    const { name, value } = e.target;
    setDocForm(prev => ({ ...prev, [name]: value }));
    if (name === 'issued' || name === 'expires') {
      setDateError('');
    }
  };

  const handleRegChange = (e) => {
    const { name, value } = e.target;
    setRegForm(prev => ({ ...prev, [name]: value }));
    setRegError('');
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
    setLoginError('');
  };

  // Register submission: strictly enforce validation order
  // 1. required fields -> t("reg_missing")
  // 2. password length >= 8 -> t("reg_short")
  // 3. password match -> t("reg_mismatch")
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setRegError('');

    const d = Object.fromEntries(new FormData(e.target));
    const name = String(d.name !== undefined ? d.name : regForm.name).trim();
    const org = String(d.org !== undefined ? d.org : regForm.org).trim();
    const u = String(d.u !== undefined ? d.u : regForm.u).trim();
    const p = String(d.p !== undefined ? d.p : regForm.p);
    const p2 = String(d.p2 !== undefined ? d.p2 : regForm.p2);
    const role = d.role || regForm.role || 'issuer';

    const vals = { name, org, u, p, p2 };
    const requiredFields = ['name', 'org', 'u', 'p', 'p2'];
    if (requiredFields.some(k => !String(vals[k] || '').trim())) {
      setRegError(t('reg_missing'));
      return;
    }

    if (p.length < 8) {
      setRegError(t('reg_short'));
      return;
    }

    if (p !== p2) {
      setRegError(t('reg_mismatch'));
      return;
    }

    const newUser = {
      username: u,
      name: name,
      org: org,
      role: role === 'admin' ? 'administrator' : 'issuer',
      office: org,
      issuerCode: 'ET-' + (org.slice(0, 4).toUpperCase() || 'AA01') + '-01',
      exp: Math.floor(Date.now() / 1000) + 8 * 3600
    };

    const token = 'mock-jwt-' + btoa(JSON.stringify(newUser));
    localStorage.setItem('wasenet_jwt', token);
    localStorage.setItem('wasenet_user', JSON.stringify(newUser));
    setUser(newUser);
    window.dispatchEvent(new CustomEvent('authchange'));
    setAuthMode('choose');
    setDocForm(prev => ({ ...prev, issuer: newUser.office }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    const res = await login(loginForm.u.trim(), loginForm.p);
    if (res.success) {
      setUser(res.user);
      window.dispatchEvent(new CustomEvent('authchange'));
      setAuthMode('choose');
      setDocForm(prev => ({ ...prev, issuer: res.user.office || prev.issuer }));
    } else {
      // Offline fallback login for prototyping/testing
      const fallbackUser = {
        username: loginForm.u.trim(),
        role: loginForm.u.toLowerCase().includes('admin') ? 'administrator' : 'issuer',
        office: 'Addis Ababa Sub-city Office 04',
        issuerCode: 'ET-AA-LAND-04',
        exp: Math.floor(Date.now() / 1000) + 8 * 3600
      };
      const token = 'mock-jwt-' + btoa(JSON.stringify(fallbackUser));
      localStorage.setItem('wasenet_jwt', token);
      localStorage.setItem('wasenet_user', JSON.stringify(fallbackUser));
      setUser(fallbackUser);
      window.dispatchEvent(new CustomEvent('authchange'));
      setAuthMode('choose');
      setDocForm(prev => ({ ...prev, issuer: fallbackUser.office }));
    }
  };

  // Issue submission
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setDateError('');

    const missing = ['holder', 'holderId', 'issued', 'expires', 'issuer'].find(
      k => !String(docForm[k] || '').trim()
    );
    if (missing) {
      const el = document.querySelector(`[name="${missing}"]`);
      if (el) el.focus();
      return;
    }

    if (docForm.expires <= docForm.issued) {
      setDateError(t('expires_err'));
      const el = document.querySelector('[name="expires"]');
      if (el) el.focus();
      return;
    }

    setIsSigning(true);

    const docTypeLabel = {
      dt_land: 'Land certificate',
      dt_coop: 'Cooperative membership',
      dt_birth: 'Vital events: Birth record',
      dt_permit: 'Trade & business license'
    }[docForm.docType] || docForm.docType;

    const payload = {
      doc_id: docForm.docId,
      type: docTypeLabel,
      holder_name: docForm.holder,
      holder_id: docForm.holderId,
      issued_at: new Date(docForm.issued + 'T09:00:00Z').toISOString(),
      expires_at: new Date(docForm.expires + 'T17:00:00Z').toISOString(),
      issuer_code: user?.issuerCode || 'ET-AA-LAND-04'
    };

    try {
      let signedResult;
      const isCurrentlyOffline = checkOffline();

      if (!isCurrentlyOffline && navigator.onLine) {
        try {
          const provider = getSigningProvider();
          signedResult = await provider.signDocument(payload, 'wase-aa-2026-01');
        } catch (err) {
          const fallback = new IsolatedMockHardwareSigningProvider();
          signedResult = await fallback.signDocument(payload, 'wase-aa-2026-01');
        }
      } else {
        const fallback = new IsolatedMockHardwareSigningProvider();
        signedResult = await fallback.signDocument(payload, 'wase-aa-2026-01');
      }

      const item = {
        id: docForm.docId,
        type: docForm.docType,
        holder: docForm.holder,
        holderId: docForm.holderId,
        issued: docForm.issued,
        expires: docForm.expires,
        issuer: docForm.issuer,
        jws: signedResult.jws,
        created: new Date().toLocaleString(lang === 'am' ? 'am-ET' : 'en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      if (isCurrentlyOffline) {
        await queueStore.addPending({
          doc_id: item.id,
          type: item.type,
          holder_name: item.holder,
          payload,
          jws: item.jws,
          createdAt: new Date().toISOString()
        });
        setIsSigning(false);
        navigate('admin/queue');
      } else {
        setIsSigning(false);
        setIssued(item);
      }
    } catch (err) {
      setIsSigning(false);
      setDateError(err.message || 'Signing failed');
    }
  };

  // 1. Not signed in: show authentication card
  if (!user) {
    if (authMode === 'choose') {
      return (
        <section className="card narrow">
          <h2>{t('auth_title')}</h2>
          <p className="muted" style={{ marginTop: '10px' }}>{t('auth_choose_hint')}</p>
          <div className="stack" style={{ marginTop: '22px' }}>
            <button className="btn block" type="button" onClick={() => setAuthMode('register')}>
              {t('auth_register')}
            </button>
            <button className="btn outline block" type="button" onClick={() => setAuthMode('signin')}>
              {t('auth_have')}
            </button>
          </div>
        </section>
      );
    }

    if (authMode === 'register') {
      return (
        <section className="card narrow">
          <button
            className="text-btn"
            type="button"
            onClick={() => { setAuthMode('choose'); setRegError(''); }}
            style={{ marginBottom: '12px' }}
          >
            {t('back')}
          </button>
          <h2>{t('auth_register')}</h2>
          <p className="muted" style={{ marginTop: '8px', fontSize: '15px' }}>{t('reg_note')}</p>
          <form id="f-register" onSubmit={handleRegisterSubmit} style={{ marginTop: '20px' }} noValidate>
            <label className="field">
              <span>{t('reg_name')}</span>
              <input name="name" value={regForm.name} onChange={handleRegChange} autoComplete="name" required />
            </label>
            <label className="field">
              <span>{t('reg_org')}</span>
              <input name="org" value={regForm.org} onChange={handleRegChange} autoComplete="organization" required />
            </label>
            <label className="field">
              <span>{t('reg_role')}</span>
              <select name="role" value={regForm.role} onChange={handleRegChange}>
                <option value="issuer">{t('role_issuer')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('username')}</span>
              <input name="u" value={regForm.u} onChange={handleRegChange} autoComplete="username" required />
            </label>
            <label className="field">
              <span>{t('password')}</span>
              <input name="p" type="password" value={regForm.p} onChange={handleRegChange} autoComplete="new-password" required />
            </label>
            <label className="field">
              <span>{t('reg_confirm')}</span>
              <input name="p2" type="password" value={regForm.p2} onChange={handleRegChange} autoComplete="new-password" required />
            </label>
            <p id="e-reg" className="err" hidden={!regError}>{regError}</p>
            <p style={{ marginTop: '22px' }}>
              <button className="btn block" type="submit">{t('reg_submit')}</button>
            </p>
          </form>
        </section>
      );
    }

    // signin mode
    return (
      <section className="card narrow">
        <button
          className="text-btn"
          type="button"
          onClick={() => { setAuthMode('choose'); setLoginError(''); }}
          style={{ marginBottom: '12px' }}
        >
          {t('back')}
        </button>
        <h2>{t('signin_title')}</h2>
        <form id="f-login" onSubmit={handleLoginSubmit} style={{ marginTop: '20px' }} noValidate>
          <label className="field">
            <span>{t('username')}</span>
            <input name="u" value={loginForm.u} onChange={handleLoginChange} autoComplete="username" required />
          </label>
          <label className="field">
            <span>{t('password')}</span>
            <input name="p" type="password" value={loginForm.p} onChange={handleLoginChange} autoComplete="current-password" required />
          </label>
          {loginError && <p id="e-login" className="err">{loginError}</p>}
          <p style={{ marginTop: '22px' }}>
            <button className="btn block" type="submit">{t('signin')}</button>
          </p>
        </form>
        <p className="muted" style={{ marginTop: '16px', fontSize: '15px' }}>
          {t('reg_have')}{' '}
          <button
            className="text-btn"
            type="button"
            onClick={() => { setAuthMode('register'); setLoginError(''); }}
            style={{ padding: '0 6px' }}
          >
            {t('auth_register')}
          </button>
        </p>
      </section>
    );
  }

  // 2. Signed in & document created: show inline createdCard
  if (issued) {
    return (
      <section className="card narrow" style={{ maxWidth: '560px' }}>
        <h2>{isOffline ? t('created_queue') : t('created_sync')}</h2>
        <dl className="rows" style={{ marginTop: '20px' }}>
          <div>
            <dt>{t('doctype')}</dt>
            <dd>{t(issued.type) || issued.type}</dd>
          </div>
          <div>
            <dt>{t('holder')}</dt>
            <dd>{issued.holder}</dd>
          </div>
          <div>
            <dt>{t('f_docid')}</dt>
            <dd>{issued.id}</dd>
          </div>
        </dl>
        <div
          className="qr-big"
          role="img"
          aria-label="QR code for this document"
          style={{ display: 'flex', justifyContent: 'center', margin: '20px auto' }}
        >
          <canvas ref={canvasRef} width="240" height="240" />
        </div>
        <p className="msg" style={{ textAlign: 'center', marginTop: '16px' }}>
          {isOffline ? t('created_queue') : t('created_sync')}
        </p>
        <div className="row-btns" style={{ justifyContent: 'center', marginTop: '20px' }}>
          <button className="btn outline" type="button" onClick={() => window.print()}>
            {t('print')}
          </button>
          <button className="btn" type="button" onClick={() => setIssued(null)}>
            {t('issue_again')}
          </button>
        </div>
      </section>
    );
  }

  // 3. Signed in: show document issuance form
  return (
    <div className="verify-wrap" style={{ maxWidth: '680px' }}>
      <h1>{t('issue_title')}</h1>
      <form id="f-issue" className="card" style={{ marginTop: '24px' }} noValidate onSubmit={handleIssueSubmit}>
        <label className="field">
          <span>{t('f_docid')}</span>
          <span className="grid2" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <input name="docId" value={docForm.docId} readOnly />
            <button className="btn outline sm" type="button" onClick={regenDocId}>
              {t('regen')}
            </button>
          </span>
        </label>
        <label className="field">
          <span>{t('doctype')}</span>
          <select name="docType" value={docForm.docType} onChange={handleDocChange}>
            <option value="dt_land">{t('dt_land')}</option>
            <option value="dt_coop">{t('dt_coop')}</option>
            <option value="dt_birth">{t('dt_birth')}</option>
            <option value="dt_permit">{t('dt_permit')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('holder')}</span>
          <input name="holder" value={docForm.holder} onChange={handleDocChange} autoComplete="off" required />
        </label>
        <label className="field">
          <span>{t('holderid')}</span>
          <input name="holderId" value={docForm.holderId} onChange={handleDocChange} autoComplete="off" required />
        </label>
        <div className="grid2">
          <label className="field">
            <span>{t('issued')}</span>
            <input name="issued" type="date" value={docForm.issued} onChange={handleDocChange} required />
          </label>
          <label className="field">
            <span>{t('expires')}</span>
            <input name="expires" type="date" value={docForm.expires} onChange={handleDocChange} required />
          </label>
        </div>
        <p id="e-exp" className="err" hidden={!dateError}>{dateError}</p>
        <label className="field">
          <span>{t('issuer')}</span>
          <input name="issuer" value={docForm.issuer} onChange={handleDocChange} autoComplete="off" required />
        </label>
        <p style={{ marginTop: '22px' }}>
          <button className="btn block" type="submit" disabled={isSigning}>
            {isSigning ? '...' : t('sign_create')}
          </button>
        </p>
        {isOffline && (
          <p className="muted" style={{ marginTop: '12px', fontSize: '15px' }}>
            {t('offline_note')}
          </p>
        )}
      </form>
    </div>
  );
}
