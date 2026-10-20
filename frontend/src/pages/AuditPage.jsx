import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';
import { auditStore } from '../storage.js';

export default function AuditPage({ navigate }) {
  const { t } = useI18n();
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('All');

  const loadAudit = async (f = filter) => {
    const list = await auditStore.getRecords(f);
    setRecords(list);
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('login');
      return;
    }
    loadAudit(filter);
  }, [filter]);

  return (
    <div className="container">
      <h1>{t('audit.heading')}</h1>
      <p className="muted-text">{t('audit.subheading')}</p>

      {/* Filter Tabs */}
      <div className="filter-bar" role="toolbar" aria-label="Filter verification results">
        {['All', 'Valid', 'Tampered', 'Revoked', 'Expired'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
          >
            {t(`audit.filter_${f.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Audit Events Table */}
      {records.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table" aria-label="Verification audit records">
            <thead>
              <tr>
                <th>{t('audit.col_doc_id')}</th>
                <th>{t('audit.col_timestamp')}</th>
                <th>{t('audit.col_result')}</th>
                <th>{t('audit.col_device_id')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td data-label={t('audit.col_doc_id')} style={{ wordBreak: 'break-all' }}>
                    <code>{r.doc_id || 'unknown'}</code>
                  </td>
                  <td data-label={t('audit.col_timestamp')}>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}
                  </td>
                  <td data-label={t('audit.col_result')}>
                    <span className={`tag-status ${(r.result || '').toLowerCase()}`}>
                      {r.result || 'Unknown'}
                    </span>
                  </td>
                  <td data-label={t('audit.col_device_id')} className="muted-text" style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>
                    {r.deviceId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty-state">
          <p style={{ margin: 0 }}>{t('audit.empty')}</p>
        </div>
      )}
    </div>
  );
}
