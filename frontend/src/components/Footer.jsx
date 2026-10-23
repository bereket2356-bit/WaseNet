import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getSyncStatus } from '../sync.js';

export default function Footer() {
  const { t, lang } = useI18n();
  const checkOnline = () => {
    return !window.__wasenet_simulated_offline && (typeof navigator !== 'undefined' ? navigator.onLine : true);
  };

  const [isOnline, setIsOnline] = useState(checkOnline);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null,
    drlVersion: 42,
    keyVersion: 1
  });

  const refreshStatus = async () => {
    try {
      const status = await getSyncStatus();
      if (status) setSyncStatus(status);
    } catch (e) {}
  };

  useEffect(() => {
    refreshStatus();

    const updateOnline = () => setIsOnline(checkOnline());
    const handleSyncComplete = (e) => {
      if (e.detail) setSyncStatus(e.detail);
    };

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('offlinesimchange', updateOnline);
    window.addEventListener('synccomplete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('offlinesimchange', updateOnline);
      window.removeEventListener('synccomplete', handleSyncComplete);
    };
  }, []);

  let lastSyncText = '10:14 AM';
  if (syncStatus.lastSync) {
    try {
      const dt = new Date(syncStatus.lastSync);
      lastSyncText = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
  }

  return (
    <footer className="foot" role="contentinfo">
      <div className="wrap" id="foot">
        <p>
          <span className={`dot ${isOnline ? '' : 'off'}`}></span>
          {isOnline ? t('status_online') : t('status_offline')} · {t('last_sync')}: {lastSyncText} · {t('rev_list')} v{syncStatus.drlVersion}
        </p>
        <p>© 2026 WaseNet</p>
      </div>
    </footer>
  );
}
