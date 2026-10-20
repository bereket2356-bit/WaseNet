import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, logout } from '../auth.js';

export default function MobileDrawer({ isOpen, onClose, currentRoute, navigate }) {
  const { t, lang, toggleLang } = useI18n();
  const user = getCurrentUser();
  const drawerRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNav = (targetRoute) => {
    navigate(targetRoute);
    onClose();
  };

  const handleLogout = () => {
    logout();
    onClose();
    navigate('login');
  };

  return (
    <div
      className="mobile-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
    >
      <div
        className="mobile-drawer"
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-drawer-header">
          <div>
            <div className="logo serif" style={{ fontSize: '1.3rem' }}>
              {t('brand.name')}
            </div>
            {user && (
              <div className="muted-text" style={{ fontSize: '12px', marginTop: '2px' }}>
                {user.username} ({user.role})
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ minHeight: '44px', minWidth: '44px', padding: 0, borderRadius: '50%' }}
            aria-label="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Language Switcher in Drawer */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => {
              toggleLang();
            }}
            className="lang-toggle-btn"
            style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
          >
            {lang === 'en' ? 'ቋንቋ: አማርኛ (Switch to Amharic)' : 'Language: English (ወደ እንግሊዝኛ ቀይር)'}
          </button>
        </div>

        <nav className="mobile-drawer-links" aria-label="Mobile Drawer Navigation">
          <button
            onClick={() => handleNav('landing')}
            className={`link ${currentRoute === 'landing' ? 'active' : ''}`}
          >
            {t('brand.name')} Home
          </button>

          <button
            onClick={() => handleNav('verify')}
            className={`link ${currentRoute === 'verify' ? 'active' : ''}`}
          >
            {t('nav.verify')}
          </button>

          {user ? (
            <>
              <button
                onClick={() => handleNav('issue')}
                className={`link ${currentRoute === 'issue' ? 'active' : ''}`}
              >
                {t('nav.issue')}
              </button>
              <button
                onClick={() => handleNav('queue')}
                className={`link ${currentRoute === 'queue' ? 'active' : ''}`}
              >
                {t('nav.queue')}
              </button>
              <button
                onClick={() => handleNav('audit')}
                className={`link ${currentRoute === 'audit' ? 'active' : ''}`}
              >
                {t('nav.audit')}
              </button>
              <button
                onClick={() => handleNav('sync')}
                className={`link ${currentRoute === 'sync' ? 'active' : ''}`}
              >
                {t('nav.sync')}
              </button>

              {user.role === 'administrator' && (
                <>
                  <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '8px 0' }} />
                  <div className="muted-text" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 14px' }}>
                    Administration
                  </div>
                  <button
                    onClick={() => handleNav('admin-keys')}
                    className={`link ${currentRoute === 'admin-keys' ? 'active' : ''}`}
                  >
                    {t('nav.admin_keys')}
                  </button>
                  <button
                    onClick={() => handleNav('admin-revoke')}
                    className={`link ${currentRoute === 'admin-revoke' ? 'active' : ''}`}
                  >
                    {t('nav.admin_revoke')}
                  </button>
                  <button
                    onClick={() => handleNav('admin-issuers')}
                    className={`link ${currentRoute === 'admin-issuers' ? 'active' : ''}`}
                  >
                    {t('nav.admin_issuers')}
                  </button>
                </>
              )}

              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '8px 0' }} />
              <button
                onClick={handleLogout}
                className="link"
                style={{ color: 'var(--vermilion)' }}
              >
                {t('nav.sign_out')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNav('login')}
                className={`link ${currentRoute === 'login' ? 'active' : ''}`}
              >
                {t('nav.sign_in')}
              </button>
              <button
                onClick={() => handleNav('test')}
                className={`link ${currentRoute === 'test' ? 'active' : ''}`}
              >
                Cryptographic Tests
              </button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
