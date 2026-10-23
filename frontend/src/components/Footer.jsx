import React, { useState, useEffect } from 'react';
import { getSyncStatus } from '../sync.js';

export default function Footer({ navigate }) {
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
          {isOnline ? 'Online' : 'Offline'} · Last sync: {lastSyncText} · Revocation list v{syncStatus.drlVersion}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a
            href="#/report"
            className="text-btn"
            style={{ fontSize: '14px', padding: '0 4px', minHeight: '36px' }}
            onClick={(e) => {
              if (navigate) {
                e.preventDefault();
                navigate('report');
              }
            }}
          >
            Report a fraud
          </a>
          <a
            href="#/contact"
            className="text-btn"
            style={{ fontSize: '14px', padding: '0 4px', minHeight: '36px' }}
            onClick={(e) => {
              if (navigate) {
                e.preventDefault();
                navigate('contact');
              }
            }}
          >
            Contact us
          </a>
          <span>© 2026 WaseNet</span>
        </div>
      </div>
    </footer>
  );
}
