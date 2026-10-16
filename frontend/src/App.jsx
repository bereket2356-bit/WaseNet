import React, { useState, useEffect } from 'react';
import { I18nProvider } from './i18n.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

import LandingPage from './pages/LandingPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import IssuePage from './pages/IssuePage.jsx';
import IssueDonePage from './pages/IssueDonePage.jsx';
import QueuePage from './pages/QueuePage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import AdminKeysPage from './pages/AdminKeysPage.jsx';
import AdminRevokePage from './pages/AdminRevokePage.jsx';
import AdminIssuersPage from './pages/AdminIssuersPage.jsx';
import SyncPage from './pages/SyncPage.jsx';
import TestPage from './pages/TestPage.jsx';

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
  return { route: routePart || 'landing', params };
}

function MainApp() {
  const [routeState, setRouteState] = useState(() => parseHash());

  useEffect(() => {
    const handleHashChange = () => {
      setRouteState(parseHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (newRoute, params = {}) => {
    let hash = `#/${newRoute}`;
    const keys = Object.keys(params);
    if (keys.length > 0) {
      const q = new URLSearchParams();
      keys.forEach((k) => q.set(k, params[k]));
      hash += `?${q.toString()}`;
    }
    window.location.hash = hash;
    setRouteState({ route: newRoute, params });
    window.scrollTo(0, 0);
  };

  const { route, params } = routeState;

  // Toggle landing page background vs app shell background
  useEffect(() => {
    if (route === 'landing' || !route) {
      document.body.classList.add('landing-page');
    } else {
      document.body.classList.remove('landing-page');
    }
  }, [route]);

  let PageComponent = LandingPage;
  switch (route) {
    case 'verify':
      PageComponent = VerifyPage;
      break;
    case 'result':
      PageComponent = ResultPage;
      break;
    case 'login':
      PageComponent = LoginPage;
      break;
    case 'issue':
      PageComponent = IssuePage;
      break;
    case 'issue-done':
      PageComponent = IssueDonePage;
      break;
    case 'queue':
      PageComponent = QueuePage;
      break;
    case 'audit':
      PageComponent = AuditPage;
      break;
    case 'admin-keys':
      PageComponent = AdminKeysPage;
      break;
    case 'admin-revoke':
      PageComponent = AdminRevokePage;
      break;
    case 'admin-issuers':
      PageComponent = AdminIssuersPage;
      break;
    case 'sync':
      PageComponent = SyncPage;
      break;
    case 'test':
      PageComponent = TestPage;
      break;
    default:
      PageComponent = LandingPage;
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header currentRoute={route} navigate={navigate} />

      <main className="main-content" id="main-content">
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
