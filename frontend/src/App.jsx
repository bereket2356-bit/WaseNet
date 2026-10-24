import React, { useState, useEffect } from 'react';
import { I18nProvider, useI18n } from './i18n.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

import LandingPage from './pages/LandingPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import HowPage from './pages/HowPage.jsx';
import IssuePage from './pages/IssuePage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import ContactPage from './pages/ContactPage.jsx';

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [routePart, queryPart] = hash.split('?');
  const params = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    for (const [k, v] of searchParams.entries()) {
      params[k] = v;
    }
  }

  const parts = (routePart || '').split('/');
  let route = parts[0] || 'home';
  if (route === 'landing') route = 'home';

  // Legacy route redirections following Admin relocation
  if (route === 'admin' || route === 'queue' || route === 'sync' || route === 'admin-keys' || route === 'admin-revoke' || route === 'admin-issuers' || route === 'login' || route === 'issue-done') {
    if (typeof window !== 'undefined' && window.location.hash && !window.location.hash.startsWith('#/issue')) {
      try {
        window.location.replace('#/issue');
      } catch (e) {}
    }
    route = 'issue';
  } else if (route === 'audit') {
    if (typeof window !== 'undefined' && window.location.hash && !window.location.hash.startsWith('#/verify')) {
      try {
        window.location.replace('#/verify');
      } catch (e) {}
    }
    route = 'verify';
  }

  return { route, params };
}

function MainApp() {
  const { t } = useI18n();
  const [routeState, setRouteState] = useState(() => parseHash());

  useEffect(() => {
    const handleHashChange = () => {
      setRouteState(parseHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newRoute, newParams = {}) => {
    let hash = `#/${newRoute}`;
    const keys = Object.keys(newParams);
    if (keys.length > 0) {
      const q = new URLSearchParams();
      keys.forEach((k) => q.set(k, newParams[k]));
      hash += `?${q.toString()}`;
    }
    window.location.hash = hash;
    setRouteState(parseHash());
    window.scrollTo(0, 0);
  };

  const { route, params } = routeState;

  // Update document title to match reference
  useEffect(() => {
    const titles = {
      home: 'WaseNet',
      verify: 'WaseNet · Scan a document',
      result: 'WaseNet · Verification result',
      how: 'WaseNet · How it works',
      issue: 'WaseNet · Issue a document',
      report: 'WaseNet · Report a fraud',
      contact: 'WaseNet · Contact us'
    };
    document.title = titles[route] || 'WaseNet';
  }, [route]);

  let PageComponent = LandingPage;
  switch (route) {
    case 'verify':
      PageComponent = VerifyPage;
      break;
    case 'result':
      PageComponent = ResultPage;
      break;
    case 'how':
      PageComponent = HowPage;
      break;
    case 'issue':
      PageComponent = IssuePage;
      break;
    case 'report':
      PageComponent = ReportPage;
      break;
    case 'contact':
      PageComponent = ContactPage;
      break;
    case 'home':
    default:
      PageComponent = LandingPage;
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', minHeight: '100dvh', width: '100%', minWidth: 0 }}>
      <Header currentRoute={route} navigate={navigate} />

      <main className="main-content wrap" id="main-content" tabIndex="-1" style={{ flex: '1 0 auto', minWidth: 0 }}>
        <PageComponent routeParams={params} navigate={navigate} />
      </main>

      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <MainApp />
    </I18nProvider>
  );
}
