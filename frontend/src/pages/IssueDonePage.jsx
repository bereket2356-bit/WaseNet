import React, { useRef, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';
import { QrCodeGenerator } from '../qr-generator.js';

export default function IssueDonePage({ routeParams, navigate }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);

  const doc = routeParams || {};

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('login');
      return;
    }

    if (!doc.docId) {
      navigate('issue');
      return;
    }

    if (canvasRef.current && doc.jws) {
      QrCodeGenerator.drawToCanvas(canvasRef.current, doc.jws, 280);
    }
  }, [doc]);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `wasenet-${(doc.docId || 'credential').substring(0, 8)}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="container-narrow">
      <h1>{t('done.heading')}</h1>
      <p className="muted-text">{t('done.subheading')}</p>

      <div className="panel">
        {doc.photo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                width: '4cm',
                height: '4cm',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--line)',
                backgroundColor: 'var(--stage)'
              }}
            >
              <img
                src={doc.photo}
                alt={`Photo of ${doc.holderName || 'Holder'}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        )}
        <div className="details-list" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="detail-row">
            <span className="detail-label">{t('result.detail.doc_type')}</span>
            <strong className="detail-value">{doc.type || '—'}</strong>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('result.detail.holder_name')}</span>
            <span className="detail-value">{doc.holderName || '—'}</span>
          </div>
          {doc.holderId && (
            <div className="detail-row">
              <span className="detail-label">Holder national ID (FAN)</span>
              <span className="detail-value">
                {String(doc.holderId).replace(/\D/g, '').length === 16
                  ? String(doc.holderId).replace(/\D/g, '').replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1-$2-$3-$4')
                  : doc.holderId}
              </span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">{t('result.detail.doc_id')}</span>
            <span className="detail-value">{doc.docId || '—'}</span>
          </div>
        </div>

        {/* Large QR Code Display (Level M) */}
        <div className="qr-display-box">
          <div className="qr-canvas-wrap">
            <canvas ref={canvasRef} width="280" height="280" aria-label="Official WaseNet document QR code"></canvas>
          </div>
          <div className="muted-text" style={{ fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            {t('done.qr_caption')}
          </div>

          <div className="qr-actions">
            <button onClick={handlePrint} className="btn btn-secondary">
              {t('done.btn_print')}
            </button>
            <button onClick={handleSaveImage} className="btn btn-secondary">
              {t('done.btn_save_img')}
            </button>
          </div>
        </div>

        {/* Status Line: Created and synced / Waiting to sync */}
        <div
          style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-panel-alt)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <span className="muted-text" style={{ fontSize: '0.9rem' }}>Registry synchronization:</span>
          <span className={`tag-status ${doc.synced ? 'valid' : 'expired'}`}>
            {doc.synced ? t('done.status_online') : t('done.status_offline')}
          </span>
        </div>

        {/* Issue Another Document */}
        <div style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
          <button
            onClick={() => navigate('issue')}
            className="btn btn-primary btn-full"
            style={{ minHeight: '48px' }}
          >
            {t('done.link_issue_another')}
          </button>
        </div>
      </div>
    </div>
  );
}
