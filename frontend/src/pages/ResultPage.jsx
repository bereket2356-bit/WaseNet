import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { verifyDocumentCredential } from '../crypto.js';
import { keyStore, drlStore, auditStore } from '../storage.js';

// Meaningful Inline SVGs for status
const ICONS = {
  VALID: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="28" height="28">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  TAMPERED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#A8322A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="28" height="28">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  ),
  REVOKED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#A8322A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="28" height="28">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
  ),
  EXPIRED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#8A5A12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="28" height="28">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  UNREADABLE: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#1E2B30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="28" height="28">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  )
};

export default function ResultPage({ routeParams, navigate }) {
  const { t, lang } = useI18n();
  const [resultState, setResultState] = useState({
    status: 'LOADING',
    payload: null,
    docId: null
  });
  const [onlineCheckText, setOnlineCheckText] = useState(null);

  useEffect(() => {
    async function evaluate() {
      const jws = routeParams?.jws || sessionStorage.getItem('wase_verify_jws');
      const docId = routeParams?.id;

      if (jws) {
        const verification = await verifyDocumentCredential(jws, keyStore, drlStore);
        await auditStore.addRecord(verification.docId || 'unknown', verification.status);
        setResultState({
          status: verification.status,
          payload: verification.payload,
          docId: verification.docId
        });

        // Background live check if connected (FR-3.5)
        if (navigator.onLine && verification.docId && verification.status !== 'TAMPERED') {
          checkOnlineBackground(verification.docId);
        }
      } else if (docId) {
        // ID lookup
        const isRevoked = await drlStore.isRevoked(docId);
        if (isRevoked) {
          await auditStore.addRecord(docId, 'REVOKED');
          setResultState({ status: 'REVOKED', payload: { doc_id: docId, type: 'Certificate' }, docId });
        } else if (navigator.onLine) {
          try {
            const res = await fetch(`/api/verify/${encodeURIComponent(docId)}`);
            if (res.ok) {
              const data = await res.json();
              await auditStore.addRecord(docId, data.status);
              setResultState({ status: data.status, payload: data.payload, docId });
            } else {
              setResultState({ status: 'UNREADABLE', payload: null, docId });
            }
          } catch (e) {
            setResultState({ status: 'UNREADABLE', payload: null, docId });
          }
        } else {
          setResultState({ status: 'UNREADABLE', payload: null, docId });
        }
      } else {
        setResultState({ status: 'UNREADABLE', payload: null, docId: null });
      }
    }

    evaluate();
  }, [routeParams]);

  const checkOnlineBackground = async (id) => {
    setOnlineCheckText(t('result.online_check_pending'));
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(id)}`);
      if (res.ok) {
        setOnlineCheckText(t('result.online_check_status'));
      }
    } catch (e) {
      setOnlineCheckText(null);
    }
  };

  const { status, payload } = resultState;

  if (status === 'LOADING') {
    return (
      <div className="container-narrow" style={{ textAlign: 'center', padding: 'var(--space-7) 0' }}>
        <p className="muted-text">Verifying digital certificate…</p>
      </div>
    );
  }

  // Titles & Messages based on state
  let title = '';
  let desc = '';
  if (status === 'VALID') {
    title = t('result.status.valid.title');
    desc = t('result.status.valid.desc');
  } else if (status === 'TAMPERED') {
    title = t('result.status.tampered.title');
    desc = t('result.status.tampered.desc');
  } else if (status === 'REVOKED') {
    title = t('result.status.revoked.title');
    desc = t('result.status.revoked.desc');
  } else if (status === 'EXPIRED') {
    title = t('result.status.expired.title');
    desc = t('result.status.expired.desc');
  } else {
    title = t('result.status.unreadable.title');
    desc = t('result.status.unreadable.desc');
  }

  const showDetails = status === 'VALID' || status === 'REVOKED' || status === 'EXPIRED';

  const typeDisplay =
    lang === 'am' && payload?.type_am ? payload.type_am : payload?.type || 'Standard credential';

  return (
    <div className="container-narrow">
      <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('result.heading')}</h1>

      {/* Full-width Banner (role="status") - Guaranteed visible without scrolling on phones */}
      <section
        className={`result-banner status-${status.toLowerCase()}`}
        role="status"
        aria-live="polite"
      >
        <div className="banner-header">
          <div className="banner-icon" aria-hidden="true">
            {ICONS[status] || ICONS.UNREADABLE}
          </div>
          <div>
            <h2 className="banner-title">{title}</h2>
            <p className="banner-message">{desc}</p>
          </div>
        </div>
      </section>

      {/* Document Details List (Shown ONLY for Valid, Revoked, Expired) */}
      {showDetails && payload && (
        <section aria-labelledby="details-heading">
          <h2
            id="details-heading"
            className="muted-text"
            style={{ fontSize: '1.05rem', marginBottom: 'var(--space-2)' }}
          >
            {t('result.details_title')}
          </h2>
          <div className="details-list">
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.doc_type')}</span>
              <strong className="detail-value">{typeDisplay}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.holder_name')}</span>
              <span className="detail-value">{payload.holder_name || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.holder_id')}</span>
              <span className="detail-value">{payload.holder_id || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.issuer_code')}</span>
              <span className="detail-value">{payload.issuer_code || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.doc_id')}</span>
              <span className="detail-value">{payload.doc_id || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.issued')}</span>
              <span className="detail-value">
                {payload.issued_at ? payload.issued_at.split('T')[0] : '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('result.detail.expires')}</span>
              <span className="detail-value">
                {payload.expires_at ? payload.expires_at.split('T')[0] : '—'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Details Hidden Notice (Tampered or Unreadable) */}
      {!showDetails && (
        <div className="tamper-notice">
          <p style={{ margin: 0 }}>
            {status === 'UNREADABLE'
              ? t('result.status.unreadable.desc')
              : t('result.details_hidden')}
          </p>
        </div>
      )}

      {/* Background Live Check Indicator */}
      {onlineCheckText && (
        <div style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem' }} className="muted-text">
          {onlineCheckText}
        </div>
      )}

      {/* Primary Action Button */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <button
          onClick={() => navigate('verify')}
          className="btn btn-primary btn-full"
          style={{ minHeight: '50px' }}
        >
          {t('result.btn_scan_another')}
        </button>
      </div>
    </div>
  );
}
