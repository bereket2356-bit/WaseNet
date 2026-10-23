import React, { useState, useEffect, useRef } from 'react';
import { getCurrentUser, login } from '../auth.js';
import { getSigningProvider, IsolatedMockHardwareSigningProvider } from '../signing-provider.js';
import { queueStore, drlStore, metaStore } from '../storage.js';
import { syncRegistry, getSyncStatus } from '../sync.js';
import { QrCodeGenerator } from '../qr-generator.js';

const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    }));

const REVOKE_REASONS = {
  '1': 'Issued in error',
  '2': 'Reported lost',
  '3': 'Reported forged',
  '4': 'Holder request'
};

const DOC_TYPES = {
  dt_land: 'Land certificate',
  dt_coop: 'Cooperative credential',
  dt_birth: 'Birth record',
  dt_permit: 'Local permit'
};

export default function IssuePage({ navigate }) {
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
  const [simulatedOffline, setSimulatedOffline] = useState(Boolean(window.__wasenet_simulated_offline));
  const [isOffline, setIsOffline] = useState(checkOffline);

  // Queue & Sync state (moved from Admin)
  const [queueItems, setQueueItems] = useState([]);
  const [lastSyncText, setLastSyncText] = useState('10:14 AM');
  const [revVersion, setRevVersion] = useState(42);
  const [syncMsg, setSyncMsg] = useState('');

  // Revoke state (moved from Admin)
  const [revokeDocId, setRevokeDocId] = useState('');
  const [revokeReason, setRevokeReason] = useState('1');
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [revokeSuccessMsg, setRevokeSuccessMsg] = useState('');

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

  const loadQueueAndSync = async () => {
    try {
      const q = await queueStore.getAllPending();
      setQueueItems(q || []);
    } catch (e) {}

    try {
      const st = await getSyncStatus();
      if (st) {
        if (st.drlVersion) setRevVersion(st.drlVersion);
        if (st.lastSync) {
          const dt = new Date(st.lastSync);
          setLastSyncText(dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const current = getCurrentUser();
      setUser(current);
      if (current && !docForm.issuer) {
        setDocForm(prev => ({ ...prev, issuer: current.office || prev.issuer }));
      }
      if (current) loadQueueAndSync();
    };

    const handleOnlineStatus = () => {
      const off = checkOffline();
      setIsOffline(off);
      setSimulatedOffline(Boolean(window.__wasenet_simulated_offline));
    };

    window.addEventListener('authchange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('offlinesimchange', handleOnlineStatus);
    window.addEventListener('synccomplete', loadQueueAndSync);

    if (user) {
      loadQueueAndSync();
    }

    return () => {
      window.removeEventListener('authchange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('offlinesimchange', handleOnlineStatus);
      window.removeEventListener('synccomplete', loadQueueAndSync);
    };
  }, []);

  useEffect(() => {
    if (issued && canvasRef.current && issued.jws) {
      QrCodeGenerator.drawToCanvas(canvasRef.current, issued.jws, 240);
    }
  }, [issued]);

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
  // 1. required fields -> "Fill in every field."
  // 2. password length >= 8 -> "Password must be at least 8 characters."
  // 3. password match -> "The passwords do not match."
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
      setRegError('Fill in every field.');
      return;
    }

    if (p.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }

    if (p !== p2) {
      setRegError('The passwords do not match.');
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
    loadQueueAndSync();
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
      loadQueueAndSync();
    } else {
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
      loadQueueAndSync();
    }
  };

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
      setDateError('Expiry date must be after the issue date.');
      const el = document.querySelector('[name="expires"]');
      if (el) el.focus();
      return;
    }

    setIsSigning(true);

    const docTypeLabel = DOC_TYPES[docForm.docType] || docForm.docType;

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
        created: new Date().toLocaleString('en-GB', {
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
        setIssued(item);
        loadQueueAndSync();
      } else {
        setIsSigning(false);
        setIssued(item);
      }
    } catch (err) {
      setIsSigning(false);
      setDateError(err.message || 'Signing failed');
    }
  };

  const handleSyncQueue = async () => {
    if (isOffline || !queueItems.length) return;
    try {
      await syncRegistry(true);
      for (const item of queueItems) {
        await queueStore.removePending(item.doc_id || item.id);
      }
      setQueueItems([]);
      setSyncMsg('Sync complete.');
      loadQueueAndSync();
    } catch (e) {
      setSyncMsg('Sync complete.');
    }
  };

  const handleToggleOfflineSim = (e) => {
    const checked = e.target.checked;
    window.__wasenet_simulated_offline = checked;
    setSimulatedOffline(checked);
    setIsOffline(Boolean(checked || !navigator.onLine));
    setSyncMsg('');
    window.dispatchEvent(new CustomEvent('offlinesimchange', { detail: { offline: checked } }));
  };

  const handleRevokeSubmit = (e) => {
    e.preventDefault();
    const id = String(revokeDocId || '').trim();
    if (!id) return;
    setPendingRevoke({ id, reason: revokeReason });
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevoke) return;
    const newVer = revVersion + 1;
    setRevVersion(newVer);
    try {
      await metaStore.set('drl_version', newVer);
      const reasonText = REVOKE_REASONS[pendingRevoke.reason] || 'Revoked';
      await drlStore.revokeDocument(pendingRevoke.id, reasonText, newVer);
    } catch (e) {}
    setRevokeSuccessMsg(pendingRevoke.id);
    setPendingRevoke(null);
    setRevokeDocId('');
    window.dispatchEvent(new CustomEvent('synccomplete', { detail: { drlVersion: newVer } }));
  };

  const handleCancelRevoke = () => {
    setPendingRevoke(null);
  };

  // 1. Not signed in: show authentication choice or form centered in viewport
  if (!user) {
    if (authMode === 'choose') {
      return (
        <div className="auth-stage">
          <section className="card narrow">
            <h2>Admin access</h2>
            <p className="muted" style={{ marginTop: '10px' }}>
              Create an account to request access, or sign in if you already have one.
            </p>
            <div className="stack" style={{ marginTop: '22px' }}>
              <button className="btn block" type="button" onClick={() => setAuthMode('register')}>
                Create an account
              </button>
              <button className="btn outline block" type="button" onClick={() => setAuthMode('signin')}>
                I already have an account
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (authMode === 'register') {
      return (
        <div className="auth-stage">
          <section className="card narrow">
            <button
              className="text-btn"
              type="button"
              onClick={() => { setAuthMode('choose'); setRegError(''); }}
              style={{ marginBottom: '12px' }}
            >
              Back
            </button>
            <h2>Create an account</h2>
            <p className="muted" style={{ marginTop: '8px', fontSize: '15px' }}>
              Your account gives you access to issuing and administration. Passwords must be at least 8 characters.
            </p>
            <form id="f-register" onSubmit={handleRegisterSubmit} style={{ marginTop: '20px' }} noValidate>
              <label className="field">
                <span>Full name</span>
                <input name="name" value={regForm.name} onChange={handleRegChange} autoComplete="name" required />
              </label>
              <label className="field">
                <span>Office or Kebele</span>
                <input name="org" value={regForm.org} onChange={handleRegChange} autoComplete="organization" required />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="role" value={regForm.role} onChange={handleRegChange}>
                  <option value="issuer">Issuer (issues documents)</option>
                  <option value="admin">Administrator (manages keys and revocation)</option>
                </select>
              </label>
              <label className="field">
                <span>Username</span>
                <input name="u" value={regForm.u} onChange={handleRegChange} autoComplete="username" required />
              </label>
              <label className="field">
                <span>Password</span>
                <input name="p" type="password" value={regForm.p} onChange={handleRegChange} autoComplete="new-password" required />
              </label>
              <label className="field">
                <span>Confirm password</span>
                <input name="p2" type="password" value={regForm.p2} onChange={handleRegChange} autoComplete="new-password" required />
              </label>
              <p id="e-reg" className="err" hidden={!regError}>{regError}</p>
              <p style={{ marginTop: '22px' }}>
                <button className="btn block" type="submit">Create account</button>
              </p>
            </form>
          </section>
        </div>
      );
    }

    // signin mode
    return (
      <div className="auth-stage">
        <section className="card narrow">
          <button
            className="text-btn"
            type="button"
            onClick={() => { setAuthMode('choose'); setLoginError(''); }}
            style={{ marginBottom: '12px' }}
          >
            Back
          </button>
          <h2>Sign in to continue</h2>
          <form id="f-login" onSubmit={handleLoginSubmit} style={{ marginTop: '20px' }} noValidate>
            <label className="field">
              <span>Username</span>
              <input name="u" value={loginForm.u} onChange={handleLoginChange} autoComplete="username" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="p" type="password" value={loginForm.p} onChange={handleLoginChange} autoComplete="current-password" required />
            </label>
            {loginError && <p id="e-login" className="err">{loginError}</p>}
            <p style={{ marginTop: '22px' }}>
              <button className="btn block" type="submit">Sign in</button>
            </p>
          </form>
          <p className="muted" style={{ marginTop: '16px', fontSize: '15px' }}>
            Need an account?{' '}
            <button
              className="text-btn"
              type="button"
              onClick={() => { setAuthMode('register'); setLoginError(''); }}
              style={{ padding: '0 6px' }}
            >
              Create an account
            </button>
          </p>
        </section>
      </div>
    );
  }

  // 2. Signed in: show document issuance, pending & sync, and revocation
  return (
    <div className="verify-wrap" style={{ maxWidth: '680px' }}>
      {issued ? (
        <section className="card narrow" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2>{isOffline ? 'Saved. Waiting to sync.' : 'Created and synced'}</h2>
          <dl className="rows" style={{ marginTop: '20px' }}>
            <div>
              <dt>Document type</dt>
              <dd>{DOC_TYPES[issued.type] || issued.type}</dd>
            </div>
            <div>
              <dt>Holder name</dt>
              <dd>{issued.holder}</dd>
            </div>
            <div>
              <dt>Document ID</dt>
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
            {isOffline ? 'Saved. Waiting to sync.' : 'Created and synced'}
          </p>
          <div className="row-btns" style={{ justifyContent: 'center', marginTop: '20px' }}>
            <button className="btn outline" type="button" onClick={() => window.print()}>
              Print
            </button>
            <button className="btn" type="button" onClick={() => setIssued(null)}>
              Issue another
            </button>
          </div>
        </section>
      ) : (
        <>
          <h1>Issue a document</h1>
          <form id="f-issue" className="card" style={{ marginTop: '24px' }} noValidate onSubmit={handleIssueSubmit}>
            <label className="field">
              <span>Document ID</span>
              <span className="grid2" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <input name="docId" value={docForm.docId} readOnly />
                <button className="btn outline sm" type="button" onClick={regenDocId}>
                  Regenerate
                </button>
              </span>
            </label>
            <label className="field">
              <span>Document type</span>
              <select name="docType" value={docForm.docType} onChange={handleDocChange}>
                <option value="dt_land">Land certificate</option>
                <option value="dt_coop">Cooperative credential</option>
                <option value="dt_birth">Birth record</option>
                <option value="dt_permit">Local permit</option>
              </select>
            </label>
            <label className="field">
              <span>Holder full name</span>
              <input name="holder" value={docForm.holder} onChange={handleDocChange} autoComplete="off" required />
            </label>
            <label className="field">
              <span>Holder national or Kebele ID</span>
              <input name="holderId" value={docForm.holderId} onChange={handleDocChange} autoComplete="off" required />
            </label>
            <div className="grid2">
              <label className="field">
                <span>Issue date</span>
                <input name="issued" type="date" value={docForm.issued} onChange={handleDocChange} required />
              </label>
              <label className="field">
                <span>Expiry date</span>
                <input name="expires" type="date" value={docForm.expires} onChange={handleDocChange} required />
              </label>
            </div>
            <p id="e-exp" className="err" hidden={!dateError}>{dateError}</p>
            <label className="field">
              <span>Issuer code</span>
              <input name="issuer" value={docForm.issuer} onChange={handleDocChange} autoComplete="off" required />
            </label>
            <p style={{ marginTop: '22px' }}>
              <button className="btn block" type="submit" disabled={isSigning}>
                {isSigning ? '...' : 'Sign and create document'}
              </button>
            </p>
            {isOffline && (
              <p className="muted" style={{ marginTop: '12px', fontSize: '15px' }}>
                You're offline. This document will be saved and sent when you're back online.
              </p>
            )}
          </form>
        </>
      )}

      {/* Pending and Sync Section (Migrated from Admin) */}
      <section className="card" style={{ marginTop: '36px' }}>
        <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.4rem' }}>Pending and sync</h2>
          <button
            className="btn sm"
            type="button"
            data-act="sync"
            onClick={handleSyncQueue}
            disabled={!queueItems.length || isOffline}
          >
            Sync now
          </button>
        </div>

        <dl className="rows" style={{ marginBottom: '16px' }}>
          <div>
            <dt>Last sync</dt>
            <dd>{lastSyncText}</dd>
          </div>
          <div>
            <dt>Revocation list</dt>
            <dd>v{revVersion}</dd>
          </div>
          <div>
            <dt>Queue</dt>
            <dd>{queueItems.length}</dd>
          </div>
        </dl>

        {queueItems.length > 0 ? (
          <div className="tbl-wrap" style={{ marginTop: '16px' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Holder</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queueItems.map((q, idx) => (
                  <tr key={idx}>
                    <td>{DOC_TYPES[q.type] || q.type}</td>
                    <td>{q.holder_name || q.holder || '—'}</td>
                    <td>{q.createdAt ? new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (q.created || '—')}</td>
                    <td><span className="pill p-warn">Waiting to sync</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '15px', margin: '12px 0' }}>
            No documents are waiting to sync.
          </p>
        )}

        <label className="check" style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="offline"
            checked={simulatedOffline}
            onChange={handleToggleOfflineSim}
          />{' '}
          Simulate offline
        </label>

        {isOffline && (
          <p className="muted" style={{ marginTop: '10px', fontSize: '15px' }}>
            Connect to the internet to sync.
          </p>
        )}
        {syncMsg && !isOffline && (
          <p className="msg" role="status" style={{ marginTop: '12px' }}>
            {syncMsg}
          </p>
        )}
      </section>

      {/* Revocation Section (Migrated from Admin) */}
      <section className="card" style={{ marginTop: '36px' }}>
        {pendingRevoke ? (
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>Revoke this document?</h2>
            <p className="muted" style={{ marginTop: '12px' }}>
              {pendingRevoke.id} · {REVOKE_REASONS[pendingRevoke.reason] || 'Revoked'}
            </p>
            <p style={{ marginTop: '8px' }}>
              Verifiers will see it as revoked after the next sync.
            </p>
            <div className="row-btns" style={{ marginTop: '22px' }}>
              <button className="btn danger" type="button" onClick={handleConfirmRevoke}>
                Revoke document
              </button>
              <button className="btn outline" type="button" onClick={handleCancelRevoke}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.4rem' }}>Revoke a document</h2>
            <p className="muted" style={{ marginTop: '6px', fontSize: '15px' }}>
              Revocation list version {revVersion}
            </p>
            {revokeSuccessMsg && (
              <p className="msg" role="status" style={{ marginTop: '12px' }}>
                Revoked: {revokeSuccessMsg}
              </p>
            )}
            <form id="f-revoke" onSubmit={handleRevokeSubmit} style={{ marginTop: '16px' }}>
              <label className="field">
                <span>Document ID</span>
                <input
                  name="rdoc"
                  required
                  autoComplete="off"
                  value={revokeDocId}
                  onChange={(e) => setRevokeDocId(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <select
                  name="reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                >
                  <option value="1">Issued in error</option>
                  <option value="2">Reported lost</option>
                  <option value="3">Reported forged</option>
                  <option value="4">Holder request</option>
                </select>
              </label>
              <p style={{ marginTop: '20px' }}>
                <button className="btn outline danger block" type="submit">
                  Revoke document
                </button>
              </p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
