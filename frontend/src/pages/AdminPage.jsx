import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, login } from '../auth.js';
import { queueStore, auditStore, keyStore, drlStore, metaStore } from '../storage.js';
import { syncRegistry, getSyncStatus } from '../sync.js';

const pillFor = (st) => ({
  st_active: 'p-ok',
  st_revoked: 'p-bad',
  st_disabled: 'p-bad',
  Active: 'p-ok',
  Revoked: 'p-bad',
  Disabled: 'p-bad'
}[st] || 'p-warn');

export default function AdminPage({ routeParams, navigate }) {
  const { t, lang } = useI18n();
  const currentTab = routeParams?.tab || 'queue';

  const [user, setUser] = useState(getCurrentUser());
  const [authMode, setAuthMode] = useState('choose');
  const [regError, setRegError] = useState('');
  const [loginError, setLoginError] = useState('');

  // Forms for auth
  const [regForm, setRegForm] = useState({ name: '', org: '', role: 'admin', u: '', p: '', p2: '' });
  const [loginForm, setLoginForm] = useState({ u: '', p: '' });

  // Admin Stores State
  const [queueItems, setQueueItems] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [keys, setKeys] = useState([
    { id: 'pubkey-insa-2026-01', created: '15 Jan 2026', status: 'st_active' },
    { id: 'pubkey-insa-2025-04', created: '01 Oct 2025', status: 'st_active' },
    { id: 'pubkey-insa-2024-02', created: '12 Feb 2024', status: 'st_expired' }
  ]);
  const [issuers, setIssuers] = useState([
    { name: 'Addis Ababa Land Administration Office 04', code: 'ET-AA-LAND-04', status: 'st_active' },
    { name: 'Oromia Regional Cooperative Promotion Agency', code: 'ET-OR-COOP-01', status: 'st_active' },
    { name: 'Federal Vital Events Registration Agency (VERA)', code: 'ET-FED-VERA-02', status: 'st_active' },
    { name: 'Amhara Regional Trade and Industry Bureau', code: 'ET-AM-TRADE-03', status: 'st_disabled' }
  ]);
  const [revVersion, setRevVersion] = useState(42);
  const [lastSyncText, setLastSyncText] = useState('10:14 AM');
  const [simulatedOffline, setSimulatedOffline] = useState(Boolean(window.__wasenet_simulated_offline));
  const [isOffline, setIsOffline] = useState(Boolean(window.__wasenet_simulated_offline || !navigator.onLine));

  // Revoke tab state
  const [revokeDocId, setRevokeDocId] = useState('');
  const [revokeReason, setRevokeReason] = useState('1');
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [revokeSuccessMsg, setRevokeSuccessMsg] = useState('');

  // Sync / Queue message state
  const [queueMsg, setQueueMsg] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  const loadData = async () => {
    try {
      const q = await queueStore.getAllPending();
      setQueueItems(q);
    } catch (e) {}

    try {
      const a = await auditStore.getRecords(auditFilter === 'all' ? 'All' : auditFilter);
      setAuditRecords(a);
    } catch (e) {}

    try {
      const storedKeys = await keyStore.getAllKeys();
      if (storedKeys && storedKeys.length > 0) {
        setKeys(storedKeys.map(k => ({
          id: k.kid || k.id,
          created: k.createdDate || k.created || '15 Jan 2026',
          status: k.status === 'Active' ? 'st_active' : (k.status === 'Revoked' ? 'st_revoked' : (k.status === 'st_active' || k.status === 'st_expired' || k.status === 'st_revoked' ? k.status : 'st_active'))
        })));
      }
    } catch (e) {}

    try {
      const status = await getSyncStatus();
      if (status) {
        if (status.drlVersion) setRevVersion(status.drlVersion);
        if (status.lastSync) {
          const dt = new Date(status.lastSync);
          setLastSyncText(dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadData();

    const handleAuthChange = () => setUser(getCurrentUser());
    const handleOnlineStatus = () => {
      const off = Boolean(window.__wasenet_simulated_offline || !navigator.onLine);
      setIsOffline(off);
      setSimulatedOffline(Boolean(window.__wasenet_simulated_offline));
    };

    window.addEventListener('authchange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('offlinesimchange', handleOnlineStatus);
    window.addEventListener('synccomplete', loadData);

    return () => {
      window.removeEventListener('authchange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('offlinesimchange', handleOnlineStatus);
      window.removeEventListener('synccomplete', loadData);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [auditFilter]);

  // Auth Handlers (Enforcing reference validation order)
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setRegError('');

    const d = Object.fromEntries(new FormData(e.target));
    const name = String(d.name !== undefined ? d.name : regForm.name).trim();
    const org = String(d.org !== undefined ? d.org : regForm.org).trim();
    const u = String(d.u !== undefined ? d.u : regForm.u).trim();
    const p = String(d.p !== undefined ? d.p : regForm.p);
    const p2 = String(d.p2 !== undefined ? d.p2 : regForm.p2);

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
      role: 'administrator',
      office: org,
      issuerCode: 'ET-ADMIN-01',
      exp: Math.floor(Date.now() / 1000) + 8 * 3600
    };

    const token = 'mock-jwt-' + btoa(JSON.stringify(newUser));
    localStorage.setItem('wasenet_jwt', token);
    localStorage.setItem('wasenet_user', JSON.stringify(newUser));
    setUser(newUser);
    window.dispatchEvent(new CustomEvent('authchange'));
    setAuthMode('choose');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    const res = await login(loginForm.u.trim(), loginForm.p);
    if (res.success) {
      setUser(res.user);
      window.dispatchEvent(new CustomEvent('authchange'));
      setAuthMode('choose');
    } else {
      const fallbackUser = {
        username: loginForm.u.trim(),
        role: 'administrator',
        office: 'National Registry Directorate',
        issuerCode: 'ET-ADMIN-01',
        exp: Math.floor(Date.now() / 1000) + 8 * 3600
      };
      const token = 'mock-jwt-' + btoa(JSON.stringify(fallbackUser));
      localStorage.setItem('wasenet_jwt', token);
      localStorage.setItem('wasenet_user', JSON.stringify(fallbackUser));
      setUser(fallbackUser);
      window.dispatchEvent(new CustomEvent('authchange'));
      setAuthMode('choose');
    }
  };

  // Queue Sync
  const handleSyncQueue = async () => {
    if (isOffline) return;
    try {
      await syncRegistry(true);
      for (const item of queueItems) {
        await queueStore.removePending(item.doc_id || item.id);
      }
      setQueueItems([]);
      setQueueMsg(t('sync_done'));
    } catch (e) {
      setQueueItems([]);
      setQueueMsg(t('sync_done'));
    }
  };

  // Key Actions
  const handleAddKey = async () => {
    const nextNum = keys.length + 1;
    const newKid = `pubkey-insa-2026-0${nextNum}`;
    const newKeyItem = {
      id: newKid,
      created: 'today',
      status: 'st_active'
    };
    try {
      await keyStore.putKey({
        kid: newKid,
        description: 'INSA Root Key',
        status: 'Active',
        createdDate: new Date().toISOString().split('T')[0]
      });
    } catch (e) {}
    setKeys(prev => [...prev, newKeyItem]);
  };

  const handleCycleKeyStatus = async (idx) => {
    const order = ['st_active', 'st_expired', 'st_revoked'];
    setKeys(prev => {
      const copy = [...prev];
      const cur = copy[idx].status;
      const next = order[(order.indexOf(cur) + 1) % order.length];
      copy[idx] = { ...copy[idx], status: next };
      return copy;
    });
  };

  // Revocation Actions
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
      const reasonText = t('rs' + pendingRevoke.reason);
      await drlStore.revokeDocument(pendingRevoke.id, reasonText, newVer);
    } catch (e) {}
    setRevokeSuccessMsg(pendingRevoke.id);
    setPendingRevoke(null);
    setRevokeDocId('');
  };

  const handleCancelRevoke = () => {
    setPendingRevoke(null);
  };

  // Issuer Actions
  const handleToggleIssuer = (idx) => {
    setIssuers(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        status: copy[idx].status === 'st_active' ? 'st_disabled' : 'st_active'
      };
      return copy;
    });
  };

  const handleAddIssuer = () => {
    const nextNum = issuers.length + 1;
    setIssuers(prev => [
      ...prev,
      {
        name: `Issuer ${nextNum}`,
        code: `ISSUER-${nextNum}`,
        status: 'st_active'
      }
    ]);
  };

  // Offline Simulation
  const handleToggleOfflineSim = (e) => {
    const checked = e.target.checked;
    window.__wasenet_simulated_offline = checked;
    setSimulatedOffline(checked);
    setIsOffline(Boolean(checked || !navigator.onLine));
    setSyncMsg('');
    window.dispatchEvent(new CustomEvent('offlinesimchange', { detail: { offline: checked } }));
  };

  // Sync Registry
  const handleSyncNow = async () => {
    if (isOffline) return;
    try {
      await syncRegistry(true);
      setLastSyncText(t('last_sync_now'));
      setSyncMsg(t('sync_done'));
    } catch (e) {
      setLastSyncText(t('last_sync_now'));
      setSyncMsg(t('sync_done'));
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
              <input name="name" value={regForm.name} onChange={e => { setRegForm(p => ({ ...p, name: e.target.value })); setRegError(''); }} autoComplete="name" required />
            </label>
            <label className="field">
              <span>{t('reg_org')}</span>
              <input name="org" value={regForm.org} onChange={e => { setRegForm(p => ({ ...p, org: e.target.value })); setRegError(''); }} autoComplete="organization" required />
            </label>
            <label className="field">
              <span>{t('reg_role')}</span>
              <select name="role" value={regForm.role} onChange={e => setRegForm(p => ({ ...p, role: e.target.value }))}>
                <option value="issuer">{t('role_issuer')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('username')}</span>
              <input name="u" value={regForm.u} onChange={e => { setRegForm(p => ({ ...p, u: e.target.value })); setRegError(''); }} autoComplete="username" required />
            </label>
            <label className="field">
              <span>{t('password')}</span>
              <input name="p" type="password" value={regForm.p} onChange={e => { setRegForm(p => ({ ...p, p: e.target.value })); setRegError(''); }} autoComplete="new-password" required />
            </label>
            <label className="field">
              <span>{t('reg_confirm')}</span>
              <input name="p2" type="password" value={regForm.p2} onChange={e => { setRegForm(p => ({ ...p, p2: e.target.value })); setRegError(''); }} autoComplete="new-password" required />
            </label>
            <p id="e-reg" className="err" hidden={!regError}>{regError}</p>
            <p style={{ marginTop: '22px' }}>
              <button className="btn block" type="submit">{t('reg_submit')}</button>
            </p>
          </form>
        </section>
      );
    }

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
            <input name="u" value={loginForm.u} onChange={e => { setLoginForm(p => ({ ...p, u: e.target.value })); setLoginError(''); }} autoComplete="username" required />
          </label>
          <label className="field">
            <span>{t('password')}</span>
            <input name="p" type="password" value={loginForm.p} onChange={e => { setLoginForm(p => ({ ...p, p: e.target.value })); setLoginError(''); }} autoComplete="current-password" required />
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

  // 2. Tabs navigation
  const tabs = ['queue', 'audit', 'keys', 'revoke', 'issuers', 'sync'];

  const renderTabsNav = () => (
    <nav className="tabs" aria-label={t('admin_title')}>
      {tabs.map(id => (
        <a
          key={id}
          href={`#/admin/${id}`}
          aria-current={id === currentTab ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate(`admin/${id}`, { tab: id });
          }}
        >
          {t('tab_' + id)}
        </a>
      ))}
    </nav>
  );

  // 3. Render tab contents
  let tabBody = null;

  if (currentTab === 'queue') {
    tabBody = (
      <>
        <div className="toolbar">
          <h2>{t('tab_queue')}</h2>
          <button
            className="btn sm"
            type="button"
            onClick={handleSyncQueue}
            disabled={!queueItems.length || isOffline}
          >
            {t('sync_now')}
          </button>
        </div>
        {queueMsg && <p className="msg" role="status">{queueMsg}</p>}
        {queueItems.length > 0 ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('th_doc')}</th>
                  <th>{t('th_holder')}</th>
                  <th>{t('th_time')}</th>
                  <th>{t('th_status')}</th>
                </tr>
              </thead>
              <tbody>
                {queueItems.map((q, idx) => (
                  <tr key={idx}>
                    <td>{t(q.type) || q.type}</td>
                    <td>{q.holder_name || q.holder || '—'}</td>
                    <td>{q.createdAt ? new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (q.created || '—')}</td>
                    <td><span className="pill p-warn">{t('st_waiting')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty">{t('empty_queue')}</div>
        )}
      </>
    );
  } else if (currentTab === 'audit') {
    tabBody = (
      <>
        <div className="toolbar">
          <h2>{t('tab_audit')}</h2>
          <label className="field" style={{ margin: 0, minWidth: '200px' }}>
            <span className="muted" style={{ fontSize: '14px', fontWeight: 700 }}>
              {t('filter_by')}
            </span>
            <select
              id="filter"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            >
              <option value="all">{t('all')}</option>
              <option value="valid">{t('r_valid_t')}</option>
              <option value="tampered">{t('r_tampered_t')}</option>
              <option value="revoked">{t('r_revoked_t')}</option>
              <option value="expired">{t('r_expired_t')}</option>
            </select>
          </label>
        </div>
        {auditRecords.length > 0 ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('th_id')}</th>
                  <th>{t('th_time')}</th>
                  <th>{t('th_result')}</th>
                  <th>{t('th_device')}</th>
                </tr>
              </thead>
              <tbody>
                {auditRecords.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ wordBreak: 'break-all' }}>{a.doc_id || a.id}</td>
                    <td>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.time || '—')}</td>
                    <td>{t('r_' + String(a.result || '').toLowerCase() + '_t') || a.result}</td>
                    <td>{a.deviceId || a.device || 'wase-dev-01'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty">{t('empty_audit')}</div>
        )}
      </>
    );
  } else if (currentTab === 'keys') {
    tabBody = (
      <>
        <div className="toolbar">
          <h2>{t('tab_keys')}</h2>
          <button className="btn sm" type="button" onClick={handleAddKey}>
            {t('add_key')}
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('th_key')}</th>
                <th>{t('th_created')}</th>
                <th>{t('th_status')}</th>
                <th>{t('th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k, i) => (
                <tr key={i}>
                  <td>{k.id}</td>
                  <td>{k.created}</td>
                  <td><span className={`pill ${pillFor(k.status)}`}>{t(k.status)}</span></td>
                  <td>
                    <button
                      className="btn outline sm"
                      type="button"
                      onClick={() => handleCycleKeyStatus(i)}
                    >
                      {t('change_status')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else if (currentTab === 'revoke') {
    if (pendingRevoke) {
      tabBody = (
        <section className="card narrow" style={{ maxWidth: '520px', margin: 0 }}>
          <h2>{t('rev_confirm_q')}</h2>
          <p className="muted" style={{ marginTop: '12px' }}>
            {pendingRevoke.id} · {t('rs' + pendingRevoke.reason)}
          </p>
          <p style={{ marginTop: '8px' }}>{t('rev_confirm_t')}</p>
          <div className="row-btns" style={{ marginTop: '22px' }}>
            <button className="btn danger" type="button" onClick={handleConfirmRevoke}>
              {t('rev_btn')}
            </button>
            <button className="btn outline" type="button" onClick={handleCancelRevoke}>
              {t('cancel')}
            </button>
          </div>
        </section>
      );
    } else {
      tabBody = (
        <>
          <h2>{t('rev_title')}</h2>
          <p className="muted" style={{ marginTop: '8px' }}>
            {t('rev_version')} {revVersion}
          </p>
          {revokeSuccessMsg && (
            <p className="msg" role="status" style={{ marginTop: '12px', maxWidth: '560px' }}>
              {revokeSuccessMsg}
            </p>
          )}
          <form
            id="f-revoke"
            className="card"
            style={{ marginTop: '20px', maxWidth: '560px' }}
            onSubmit={handleRevokeSubmit}
          >
            <label className="field">
              <span>{t('f_docid')}</span>
              <input
                name="rdoc"
                required
                autoComplete="off"
                value={revokeDocId}
                onChange={(e) => setRevokeDocId(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t('rev_reason')}</span>
              <select
                name="reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              >
                {[1, 2, 3, 4].map((i) => (
                  <option key={i} value={i}>
                    {t('rs' + i)}
                  </option>
                ))}
              </select>
            </label>
            <p style={{ marginTop: '22px' }}>
              <button className="btn block danger" type="submit">
                {t('rev_btn')}
              </button>
            </p>
          </form>
        </>
      );
    }
  } else if (currentTab === 'issuers') {
    tabBody = (
      <>
        <div className="toolbar">
          <h2>{t('tab_issuers')}</h2>
          <button className="btn sm" type="button" onClick={handleAddIssuer}>
            {t('add_issuer')}
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('th_name')}</th>
                <th>{t('th_code')}</th>
                <th>{t('th_status')}</th>
                <th>{t('th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {issuers.map((x, i) => (
                <tr key={i}>
                  <td>{x.name}</td>
                  <td>{x.code}</td>
                  <td><span className={`pill ${pillFor(x.status)}`}>{t(x.status)}</span></td>
                  <td>
                    <button
                      className="btn outline sm"
                      type="button"
                      onClick={() => handleToggleIssuer(i)}
                    >
                      {t(x.status === 'st_active' ? 'disable' : 'enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else if (currentTab === 'sync') {
    tabBody = (
      <>
        <h2>{t('tab_sync')}</h2>
        <section className="card" style={{ marginTop: '20px', maxWidth: '560px' }}>
          <dl className="rows">
            <div>
              <dt>{t('last_sync')}</dt>
              <dd>{lastSyncText}</dd>
            </div>
            <div>
              <dt>{t('rev_list')}</dt>
              <dd>v{revVersion}</dd>
            </div>
            <div>
              <dt>{t('key_bundle')}</dt>
              <dd>v{keys.length}</dd>
            </div>
          </dl>
          <label className="check" style={{ marginTop: '18px' }}>
            <input
              type="checkbox"
              id="offline"
              checked={simulatedOffline}
              onChange={handleToggleOfflineSim}
            />{' '}
            {t('simulate_offline')}
          </label>
          <p style={{ marginTop: '16px' }}>
            <button
              className="btn block"
              type="button"
              onClick={handleSyncNow}
              disabled={isOffline}
            >
              {t('sync_now')}
            </button>
          </p>
          {isOffline && (
            <p className="muted" style={{ marginTop: '10px', fontSize: '15px' }}>
              {t('sync_offline')}
            </p>
          )}
          {syncMsg && !isOffline && (
            <p className="msg" role="status" style={{ marginTop: '10px' }}>
              {syncMsg}
            </p>
          )}
        </section>
      </>
    );
  }

  return (
    <div className="stack">
      {renderTabsNav()}
      {tabBody}
    </div>
  );
}
