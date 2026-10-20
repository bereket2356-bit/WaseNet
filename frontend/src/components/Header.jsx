import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, logout } from '../auth.js';
import { getSyncStatus } from '../sync.js';
import { seedInitialRegistryData } from '../storage.js';

export default function Header({ currentRoute, navigate, onOpenMenu }) {
  const { t, lang, toggleLang } = useI18n();
  const [user, setUser] = useState(getCurrentUser());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null,
    drlVersion: 42,
    keyVersion: 1
  });

  const refreshStatus = async () => {
    try {
      await seedInitialRegistryData();
      const status = await getSyncStatus();
      setSyncStatus(status);
      setUser(getCurrentUser());
    } catch (e) {}
  };

  useEffect(() => {
    refreshStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSyncComplete = (e) => {
      if (e.detail) setSyncStatus(e.detail);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('synccomplete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('synccomplete', handleSyncComplete);
    };
  }, []);

  let syncTimeText = t('sync.never');
  if (syncStatus.lastSync) {
    try {
      const dt = new Date(syncStatus.lastSync);
      syncTimeText = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
  }

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('login');
  };

  return (
    <>
      {/* Offline Alert Banner (shown only when offline) */}
      {!isOnline && (
        <div id="header-offline-banner" className="offline-banner" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          <span>{t('sync.offline_banner')}</span>
        </div>
      )}

      {/* Sync Status Bar */}
      <div className="sync-bar" aria-label="System status">
        <div className="wrap sync-bar-inner">
          {/* Mobile concise sync item */}
          <div className="sync-items-mobile">
            <button
              onClick={() => navigate('sync')}
              className="sync-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              aria-label={`System status: ${isOnline ? 'Online' : 'Offline'}. Tap to view registry sync details.`}
            >
              <span className={`status-dot ${isOnline ? '' : 'offline'}`}></span>
              <span>{isOnline ? t('sync.online') : t('sync.offline')}</span>
              <span className="muted-text" style={{ fontSize: '11px', textDecoration: 'none' }}>• {t('sync.action')}</span>
            </button>
          </div>

          {/* Desktop full sync items */}
          <div className="sync-items-desktop">
            <span className="sync-item">
              <span className={`status-dot ${isOnline ? '' : 'offline'}`}></span>
              <span>{isOnline ? t('sync.online') : t('sync.offline')}</span>
            </span>
            <span className="sync-item">
              <span>{t('sync.last_sync')}</span>
              <strong>{syncTimeText}</strong>
            </span>
            <span className="sync-item">
              <span>{t('sync.drl_version', { v: syncStatus.drlVersion })}</span>
            </span>
            <span className="sync-item">
              <span>{t('sync.key_version', { v: syncStatus.keyVersion })}</span>
            </span>
            <button
              onClick={() => navigate('sync')}
              className="sync-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
            >
              {t('sync.action')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header role="banner">
        <div className="wrap">
          <button
            onClick={() => navigate('landing')}
            className="logo serif"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'var(--ink)' }}
            aria-label="WaseNet Home"
          >
            {t('brand.name')}
          </button>

          {/* Desktop Navigation (>= 768px) */}
          <nav className="header-desktop-nav" aria-label="Main Desktop">
            <button
              onClick={() => navigate('verify')}
              className={`link ${currentRoute === 'verify' ? 'active' : ''}`}
            >
              {t('nav.verify')}
            </button>

            {user ? (
              <>
                <button
                  onClick={() => navigate('issue')}
                  className={`link ${currentRoute === 'issue' || currentRoute === 'issue-done' ? 'active' : ''}`}
                >
                  {t('nav.issue')}
                </button>
                <button
                  onClick={() => navigate('queue')}
                  className={`link ${currentRoute === 'queue' ? 'active' : ''}`}
                >
                  {t('nav.queue')}
                </button>
                <button
                  onClick={() => navigate('audit')}
                  className={`link ${currentRoute === 'audit' ? 'active' : ''}`}
                >
                  {t('nav.audit')}
                </button>

                {user.role === 'administrator' && (
                  <>
                    <button
                      onClick={() => navigate('admin-keys')}
                      className={`link ${currentRoute === 'admin-keys' ? 'active' : ''}`}
                    >
                      {t('nav.admin_keys')}
                    </button>
                    <button
                      onClick={() => navigate('admin-revoke')}
                      className={`link ${currentRoute === 'admin-revoke' ? 'active' : ''}`}
                    >
                      {t('nav.admin_revoke')}
                    </button>
                    <button
                      onClick={() => navigate('admin-issuers')}
                      className={`link ${currentRoute === 'admin-issuers' ? 'active' : ''}`}
                    >
                      {t('nav.admin_issuers')}
                    </button>
                    <button
                      onClick={() => navigate('sync')}
                      className={`link ${currentRoute === 'sync' ? 'active' : ''}`}
                    >
                      {t('nav.sync')}
                    </button>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="link"
                  id="header-logout-btn"
                >
                  {t('nav.sign_out')}
                </button>
              </>
            ) : (
              <>
                <a className="link" href="#for">
                  {t('nav.who')}
                </a>
                <a className="link" href="#stats">
                  {t('nav.how')}
                </a>
                <button
                  onClick={() => navigate('test')}
                  className={`link ${currentRoute === 'test' ? 'active' : ''}`}
                >
                  Tests
                </button>
                <button
                  onClick={() => navigate('login')}
                  className={`link ${currentRoute === 'login' ? 'active' : ''}`}
                >
                  {t('nav.sign_in')}
                </button>
              </>
            )}

            {/* Language Switcher */}
            <button
              id="lang-toggle-btn"
              className="link lang-toggle-btn"
              onClick={toggleLang}
              aria-label="Switch language"
              style={{ marginLeft: '6px' }}
            >
              {lang === 'en' ? 'አማርኛ' : 'English'}
            </button>

            {/* Check a document CTA */}
            <button
              onClick={() => navigate('verify')}
              className="btn"
              style={{ marginLeft: '10px', minHeight: '44px', padding: '0 18px', fontSize: '15px' }}
            >
              {t('nav.check_doc') || 'Check a document'}
            </button>
          </nav>

          {/* Mobile Controls (< 768px) */}
          <div className="header-mobile-controls" aria-label="Mobile Controls">
            <button
              id="lang-toggle-btn-mobile"
              className="lang-toggle-btn"
              onClick={toggleLang}
              aria-label="Switch language"
            >
              {lang === 'en' ? 'አማርኛ' : 'EN'}
            </button>

            <button
              onClick={onOpenMenu}
              className="btn btn-secondary"
              style={{ minHeight: '44px', minWidth: '44px', padding: '0 10px', borderRadius: '8px' }}
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="22" height="22">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
