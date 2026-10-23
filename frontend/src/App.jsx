import React, { useState, useEffect } from 'react';
import { I18nProvider, useI18n } from './i18n.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

import LandingPage from './pages/LandingPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import HowPage from './pages/HowPage.jsx';
import IssuePage from './pages/IssuePage.jsx';
import AdminPage from './pages/AdminPage.jsx';

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

  // Support legacy routes & subroute tabs
  if (route === 'admin' && parts[1]) {
    params.tab = parts[1];
  } else if (route === 'queue') {
    route = 'admin';
    params.tab = 'queue';
  } else if (route === 'audit') {
    route = 'admin';
    params.tab = 'audit';
  } else if (route === 'admin-keys') {
    route = 'admin';
    params.tab = 'keys';
  } else if (route === 'admin-revoke') {
    route = 'admin';
    params.tab = 'revoke';
  } else if (route === 'admin-issuers') {
    route = 'admin';
    params.tab = 'issuers';
  } else if (route === 'sync') {
    route = 'admin';
    params.tab = 'sync';
  } else if (route === 'login' || route === 'issue-done') {
    route = 'issue';
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
    const navPage = route === 'result' ? 'verify' : route;
    if (navPage === 'home') {
      document.title = 'WaseNet';
    } else {
      const titleKey = 'nav_' + navPage;
      document.title = `WaseNet · ${t(titleKey) || navPage}`;
    }
  }, [route, t]);

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
    case 'admin':
      PageComponent = AdminPage;
      break;
    case 'home':
    default:
      PageComponent = LandingPage;
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', minHeight: '100dvh' }}>
      <Header currentRoute={route} navigate={navigate} />

      <main className="main-content wrap" id="main-content" tabIndex="-1" style={{ flex: '1 0 auto', paddingBottom: '48px' }}>
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
