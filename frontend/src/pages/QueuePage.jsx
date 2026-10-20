import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';
import { queueStore } from '../storage.js';
import { syncRegistry } from '../sync.js';

export default function QueuePage({ navigate }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const loadItems = async () => {
    const list = await queueStore.getAllPending();
    setItems(list);
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('login');
      return;
    }

    loadItems();

    const handleOnline = () => {
      setIsOnline(true);
      loadItems();
    };
    const handleOffline = () => {
      setIsOnline(false);
      loadItems();
    };
    const handleSyncComplete = () => {
      loadItems();
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
    await syncRegistry(true);
    setSyncing(false);
    await loadItems();
  };

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)'
        }}
      >
        <div>
          <h1>{t('queue.heading')}</h1>
          <p className="muted-text">{t('queue.subheading')}</p>
        </div>
        <div>
          <button
            onClick={handleSyncNow}
            disabled={!isOnline || items.length === 0 || syncing}
            aria-disabled={!isOnline || items.length === 0 || syncing}
            className="btn btn-primary"
          >
            {syncing ? 'Syncing…' : t('queue.btn_sync_now')}
          </button>
        </div>
      </div>

      {/* Offline Reason Notice */}
      {!isOnline && (
        <div
          className="form-hint"
          style={{ marginBottom: 'var(--space-3)', color: 'var(--status-expired)' }}
        >
          {t('queue.offline_reason')}
        </div>
      )}

      {/* Pending Queue Table */}
      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table" aria-label="Offline issuance queue">
            <thead>
              <tr>
                <th>{t('queue.col_type')}</th>
                <th>{t('queue.col_holder')}</th>
                <th>{t('queue.col_time')}</th>
                <th>{t('queue.col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.doc_id}>
                  <td data-label={t('queue.col_type')}><strong>{doc.type || 'Document'}</strong></td>
                  <td data-label={t('queue.col_holder')}>{doc.holder_name || '—'}</td>
                  <td data-label={t('queue.col_time')}>{doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}</td>
                  <td data-label={t('queue.col_status')}>
                    <span className="tag-status expired">
                      {t('queue.status_waiting')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty-state">
          <p style={{ margin: 0 }}>{t('queue.empty')}</p>
        </div>
      )}
    </div>
  );
}
