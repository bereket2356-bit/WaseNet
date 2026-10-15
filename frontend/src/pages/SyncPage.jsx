import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getSyncStatus, syncRegistry } from '../sync.js';

export default function SyncPage({ navigate }) {
  const { t } = useI18n();
  const [status, setStatus] = useState({
    online: navigator.onLine,
    lastSync: null,
    drlVersion: 42,
    keyVersion: 1,
    pendingQueueCount: 0
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const refreshStatus = async () => {
    const s = await getSyncStatus();
    setStatus(s);
  };

  useEffect(() => {
    refreshStatus();

    const handleOnline = () => refreshStatus();
    const handleOffline = () => refreshStatus();
    const handleSyncComplete = (e) => {
      if (e.detail) setStatus(e.detail);
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

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);

    const res = await syncRegistry(true);
    setSyncing(false);

    if (res.status === 'success') {
      setSyncResult({ success: true, message: t('sync_page.sync_success') });
      await refreshStatus();
    } else {
      setSyncResult({ success: false, message: res.error || 'Sync could not be completed.' });
    }
  };

  const isOnline = status.online;

  let lastSyncFormatted = t('sync.never');
  if (status.lastSync) {
    try {
      lastSyncFormatted = new Date(status.lastSync).toLocaleString();
    } catch (e) {}
  }

  return (
    <div className="container-narrow">
      <h1>{t('sync_page.heading')}</h1>
      <p className="muted-text">{t('sync_page.subheading')}</p>

      {syncResult && (
        <div
          className="panel"
          style={{
            backgroundColor: syncResult.success ? '#EBF3EE' : '#FDF3F2',
            borderLeft: `4px solid ${syncResult.success ? 'var(--status-valid)' : 'var(--status-tampered)'}`,
            marginBottom: 'var(--space-4)'
          }}
        >
          <p
            style={{
              margin: 0,
              color: syncResult.success ? 'var(--status-valid)' : 'var(--status-tampered)',
              fontWeight: 'bold'
            }}
          >
            {syncResult.message}
          </p>
        </div>
      )}

      <div className="panel">
        <div className="details-list" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="detail-row">
            <span className="detail-label">{t('sync_page.last_sync_label')}</span>
            <strong className="detail-value">{lastSyncFormatted}</strong>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('sync_page.drl_label')}</span>
            <span className="detail-value">Version {status.drlVersion}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('sync_page.keys_label')}</span>
            <span className="detail-value">Version {status.keyVersion}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Queued offline issuances</span>
            <span className="detail-value">{status.pendingQueueCount} items</span>
          </div>
        </div>

        {/* Offline Reason Notice */}
        {!isOnline && (
          <div
            className="form-hint"
            style={{ marginBottom: 'var(--space-4)', color: 'var(--status-expired)' }}
          >
            {t('sync_page.offline_reason')}
          </div>
        )}

        {/* Sync Now Button */}
        <button
          onClick={handleSyncNow}
          disabled={!isOnline || syncing}
          aria-disabled={!isOnline || syncing}
          className="btn btn-primary btn-full"
          style={{ minHeight: '50px', fontSize: '1.05rem' }}
        >
          {syncing ? 'Synchronizing with national registry…' : t('sync_page.btn_sync')}
        </button>
      </div>
    </div>
  );
}
