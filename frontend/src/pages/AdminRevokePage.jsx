import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, getToken } from '../auth.js';
import { drlStore, metaStore } from '../storage.js';

export default function AdminRevokePage({ navigate }) {
  const { t } = useI18n();
  const [docId, setDocId] = useState('');
  const [reason, setReason] = useState('Issued in error');
  const [currentVersion, setCurrentVersion] = useState(42);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== 'administrator') {
      navigate('issue');
      return;
    }

    metaStore.get('drl_version', 42).then((v) => setCurrentVersion(v));
  }, []);

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (!docId.trim()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmRevoke = async () => {
    setRevoking(true);
    const newVer = currentVersion + 1;
    setCurrentVersion(newVer);
    await metaStore.set('drl_version', newVer);
    await drlStore.revokeDocument(docId.trim(), reason, newVer);

    // Call server if online
    if (navigator.onLine) {
      try {
        const token = getToken();
        await fetch('/api/admin/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            doc_id: docId.trim(),
            reason,
            version: newVer
          })
        });
      } catch (e) {}
    }

    setRevoking(false);
    setIsConfirmOpen(false);
    setSuccess(true);
    setDocId('');
  };

  return (
    <div className="container-narrow">
      <h1>{t('revoke.heading')}</h1>
      <p className="muted-text">{t('revoke.subheading')}</p>

      {/* DRL Version Notice */}
      <div className="panel panel-alt" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 'bold' }}>
          {t('revoke.version_notice', { v: currentVersion })}
        </p>
      </div>

      {/* Success Notification */}
      {success && (
        <div
          className="panel"
          style={{
            backgroundColor: '#EBF3EE',
            borderLeft: '4px solid var(--status-valid)',
            marginBottom: 'var(--space-4)'
          }}
        >
          <p style={{ margin: 0, color: 'var(--status-valid)', fontWeight: 'bold' }}>
            {t('revoke.success')}
          </p>
        </div>
      )}

      <div className="panel">
        <form onSubmit={handleOpenConfirm} noValidate>
          <div className="form-group">
            <label htmlFor="revoke-doc-id" className="form-label">
              {t('revoke.doc_id_label')}
            </label>
            <input
              type="text"
              id="revoke-doc-id"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="form-input"
              placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="revoke-reason" className="form-label">
              {t('revoke.reason_label')}
            </label>
            <select
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-select"
              required
            >
              <option value="Issued in error">{t('revoke.reason_error')}</option>
              <option value="Reported lost">{t('revoke.reason_lost')}</option>
              <option value="Reported forged">{t('revoke.reason_forged')}</option>
              <option value="Holder request">{t('revoke.reason_holder')}</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{
              minHeight: '48px',
              backgroundColor: 'var(--status-revoked)',
              borderColor: 'var(--status-revoked)'
            }}
          >
            Revoke document…
          </button>
        </form>
      </div>

      {/* Confirmation Step Dialog */}
      {isConfirmOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog-panel">
            <h2 style={{ color: 'var(--status-revoked)', marginBottom: 'var(--space-2)' }}>
              {t('revoke.confirm_title')}
            </h2>
            <p className="muted-text">
              {t('revoke.confirm_desc')}
            </p>
            <div
              style={{
                backgroundColor: 'var(--bg-panel-alt)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-panel)',
                marginBottom: 'var(--space-4)'
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Target document:</div>
              <strong style={{ wordBreak: 'break-all' }}>{docId}</strong>
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="btn btn-secondary"
              >
                {t('revoke.btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="btn btn-primary"
                style={{
                  backgroundColor: 'var(--status-revoked)',
                  borderColor: 'var(--status-revoked)'
                }}
              >
                {revoking ? 'Revoking…' : t('revoke.btn_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
