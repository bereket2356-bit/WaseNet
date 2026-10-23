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

export default function Header({ currentRoute, navigate }) {
  const { theme, toggleTheme } = useI18n();
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

  const getNavPage = () => {
    if (currentRoute === 'verify' || currentRoute === 'result') return 'verify';
    if (currentRoute === 'how') return 'how';
    if (currentRoute === 'issue' || currentRoute === 'issue-done') return 'issue';
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
          WaseNet
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
            Verify
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
            How it works
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
            Issue
          </a>
        </nav>

        <div className="tools" id="tools">
          <a
            href="#/report"
            className="header-report-btn"
            id="header-report-btn"
            onClick={(e) => {
              e.preventDefault();
              navigate('report');
            }}
          >
            Report a fraud
          </a>

          {user && (
            <button
              className="text-btn"
              type="button"
              id="header-logout-btn"
              onClick={handleLogout}
            >
              Sign out
            </button>
          )}

          <button
            className="icon-btn"
            id="theme"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? ICON_SUN : ICON_MOON}
          </button>
        </div>
      </div>
    </header>
  );
}
