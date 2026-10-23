import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, logout } from '../auth.js';

const ICON_MOON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const ICON_SUN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" width="20" height="20">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const ICON_GLOBE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" width="20" height="20">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
  </svg>
);

export default function Header({ currentRoute, navigate }) {
  const { t, lang, toggleLang, theme, toggleTheme } = useI18n();
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getCurrentUser());
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authchange', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authchange', handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    window.dispatchEvent(new CustomEvent('authchange'));
    navigate('home');
  };

  // Determine active nav section
  const getNavPage = () => {
    if (currentRoute === 'verify' || currentRoute === 'result') return 'verify';
    if (currentRoute === 'how') return 'how';
    if (currentRoute === 'issue' || currentRoute === 'issue-done') return 'issue';
    if (
      currentRoute === 'admin' ||
      currentRoute === 'queue' ||
      currentRoute === 'audit' ||
      currentRoute === 'admin-keys' ||
      currentRoute === 'admin-revoke' ||
      currentRoute === 'admin-issuers' ||
      currentRoute === 'sync'
    ) {
      return 'admin';
    }
    return '';
  };

  const navPage = getNavPage();

  return (
    <header className="top" role="banner">
      <div className="wrap bar">
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
          className="brand"
          aria-label="WaseNet Home"
        >
          {t('brand.name') || 'WaseNet'}
        </a>

        <nav id="nav" aria-label="Main">
          <a
            href="#/verify"
            onClick={(e) => {
              e.preventDefault();
              navigate('verify');
            }}
            className="nav-link"
            aria-current={navPage === 'verify' ? 'page' : undefined}
          >
            {t('nav_verify')}
          </a>
          <a
            href="#/how"
            onClick={(e) => {
              e.preventDefault();
              navigate('how');
            }}
            className="nav-link"
            aria-current={navPage === 'how' ? 'page' : undefined}
          >
            {t('nav_how')}
          </a>
          <a
            href="#/issue"
            onClick={(e) => {
              e.preventDefault();
              navigate('issue');
            }}
            className="nav-link"
            aria-current={navPage === 'issue' ? 'page' : undefined}
          >
            {t('nav_issue')}
          </a>
          <a
            href="#/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('admin');
            }}
            className="nav-link"
            aria-current={navPage === 'admin' ? 'page' : undefined}
          >
            {t('nav_admin')}
          </a>
        </nav>

        <div className="tools" id="tools">
          {user && (
            <button
              className="text-btn"
              type="button"
              id="header-logout-btn"
              onClick={handleLogout}
            >
              {t('sign_out')}
            </button>
          )}

          <button
            className="icon-btn"
            id="lang"
            type="button"
            onClick={toggleLang}
            aria-label={t('lang_switch')}
          >
            {ICON_GLOBE}
            <span>{lang === 'en' ? 'አማርኛ' : 'EN'}</span>
          </button>

          <button
            className="icon-btn"
            id="theme"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('theme_light') : t('theme_dark')}
          >
            {theme === 'dark' ? ICON_SUN : ICON_MOON}
          </button>
        </div>
      </div>
    </header>
  );
}
