import React from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';

export default function BottomNav({ currentRoute, navigate, onOpenMenu }) {
  const { t } = useI18n();
  const user = getCurrentUser();

  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <button
        onClick={() => navigate('verify')}
        className={`bottom-nav-item ${currentRoute === 'verify' ? 'active' : ''}`}
        aria-label={t('nav.verify')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
        <span className="bottom-nav-label">{t('nav.verify')}</span>
      </button>

      {user ? (
        <>
          <button
            onClick={() => navigate('issue')}
            className={`bottom-nav-item ${currentRoute === 'issue' || currentRoute === 'issue-done' ? 'active' : ''}`}
            aria-label={t('nav.issue')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span className="bottom-nav-label">{t('nav.issue')}</span>
          </button>

          <button
            onClick={() => navigate('queue')}
            className={`bottom-nav-item ${currentRoute === 'queue' ? 'active' : ''}`}
            aria-label={t('nav.queue')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="bottom-nav-label">{t('nav.queue')}</span>
          </button>

          <button
            onClick={() => navigate('audit')}
            className={`bottom-nav-item ${currentRoute === 'audit' ? 'active' : ''}`}
            aria-label={t('nav.audit')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="bottom-nav-label">{t('nav.audit')}</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => navigate('login')}
            className={`bottom-nav-item ${currentRoute === 'login' ? 'active' : ''}`}
            aria-label={t('nav.sign_in')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span className="bottom-nav-label">{t('nav.sign_in')}</span>
          </button>

          <button
            onClick={() => navigate('test')}
            className={`bottom-nav-item ${currentRoute === 'test' ? 'active' : ''}`}
            aria-label="Unit Tests"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="9 15 11 17 15 13" />
            </svg>
            <span className="bottom-nav-label">Tests</span>
          </button>
        </>
      )}

      {/* More / Menu Drawer Button */}
      <button
        onClick={onOpenMenu}
        className="bottom-nav-item"
        aria-label="More navigation options"
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span className="bottom-nav-label">Menu</span>
      </button>
    </nav>
  );
}
