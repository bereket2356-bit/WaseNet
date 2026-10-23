import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { verifyDocumentCredential } from '../crypto.js';
import { keyStore, drlStore, auditStore } from '../storage.js';

const RESULTS_CONFIG = {
  valid: { k: 'valid', f: 1 },
  tampered: { k: 'tampered', f: 0, note: 'hide_note' },
  revoked: { k: 'revoked', f: 1 },
  expired: { k: 'expired', f: 1 },
  error: { k: 'error', f: 0, note: 'r_error_note' }
};

const DEFAULT_DOC = {
  type: 'dt_land',
  holder: 'Abebe Bikila',
  holderId: 'ETH-98765432-X',
  issuer: 'KEBELE-04-AA',
  docId: '550e8400-e29b-41d4-a716-446655440000',
  issued: '1 Oct 2026',
  expires: '1 Oct 2028'
};

export default function ResultPage({ routeParams, navigate }) {
  const { t, lang } = useI18n();

  const [activeStatus, setActiveStatus] = useState(() => {
    if (routeParams?.s && RESULTS_CONFIG[routeParams.s]) return routeParams.s;
    return 'valid';
  });

  const [docData, setDocData] = useState(DEFAULT_DOC);

  useEffect(() => {
    async function evaluate() {
      // If direct state chip was selected
      if (routeParams?.s && RESULTS_CONFIG[routeParams.s]) {
        setActiveStatus(routeParams.s);
        if (routeParams.s === 'expired') {
          setDocData({ ...DEFAULT_DOC, expires: '1 Oct 2025' });
        } else {
          setDocData(DEFAULT_DOC);
        }
        return;
      }

      const jws = routeParams?.jws || sessionStorage.getItem('wase_verify_jws');
      const docId = routeParams?.id;

      if (jws) {
        try {
          const verification = await verifyDocumentCredential(jws, keyStore, drlStore);
          await auditStore.addRecord(verification.docId || 'unknown', verification.status);

          let st = 'valid';
          if (verification.status === 'TAMPERED') st = 'tampered';
          else if (verification.status === 'REVOKED') st = 'revoked';
          else if (verification.status === 'EXPIRED') st = 'expired';
          else if (verification.status === 'UNREADABLE') st = 'error';

          setActiveStatus(st);

          if (verification.payload) {
            const p = verification.payload;
            setDocData({
              type: lang === 'am' && p.type_am ? p.type_am : (p.type || DEFAULT_DOC.type),
              holder: p.holder_name || p.holder || DEFAULT_DOC.holder,
              holderId: p.holder_id || p.holderId || DEFAULT_DOC.holderId,
              issuer: p.issuer_code || p.issuer || DEFAULT_DOC.issuer,
              docId: verification.docId || p.doc_id || DEFAULT_DOC.docId,
              issued: p.issued_at ? p.issued_at.split('T')[0] : DEFAULT_DOC.issued,
              expires: p.expires_at ? p.expires_at.split('T')[0] : DEFAULT_DOC.expires
            });
          }
        } catch (err) {
          setActiveStatus('error');
        }
      } else if (docId) {
        // Query by manual Document ID
        try {
          const revRecord = await drlStore.isRevoked(docId);
          await auditStore.addRecord(docId, revRecord ? 'REVOKED' : 'VALID');
          setActiveStatus(revRecord ? 'revoked' : 'valid');
          setDocData({ ...DEFAULT_DOC, docId });
        } catch (e) {
          setActiveStatus('valid');
          setDocData({ ...DEFAULT_DOC, docId });
        }
      }
    }

    evaluate();
  }, [routeParams?.jws, routeParams?.id, routeParams?.s, lang]);

  const cfg = RESULTS_CONFIG[activeStatus] || RESULTS_CONFIG.valid;
  const isDetailsVisible = cfg.f === 1;

  const fields = [
    ['f_type', docData.type.startsWith('dt_') ? t(docData.type) : docData.type],
    ['f_holder', docData.holder],
    ['f_holderid', docData.holderId],
    ['f_issuer', docData.issuer],
    ['f_docid', docData.docId],
    ['f_issued', docData.issued],
    ['f_expires', docData.expires]
  ];

  return (
    <div>
      <section className="banner" data-s={cfg.k} role="status">
        <h2>{t(`r_${cfg.k}_t`)}</h2>
        <p>{t(`r_${cfg.k}_x`)}</p>
      </section>

      {isDetailsVisible && (
        <section className="card" style={{ marginTop: '16px' }}>
          <dl className="rows">
            {fields.map(([lbl, val]) => (
              <div key={lbl}>
                <dt>{t(lbl)}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {cfg.note && (
        <p className="note" style={{ marginTop: '16px' }}>
          {t(cfg.note)}
        </p>
      )}

      <div className="row-btns" style={{ marginTop: '24px' }}>
        <a
          className="btn"
          href="#/verify"
          onClick={(e) => {
            e.preventDefault();
            navigate('verify');
          }}
        >
          {t('result_again')}
        </a>
      </div>

      <div className="stack" style={{ marginTop: '36px' }}>
        <p className="muted" style={{ fontSize: '15px' }}>
          {t('result_demo')}
        </p>
        <div className="chips">
          {Object.keys(RESULTS_CONFIG).map((s) => (
            <a
              key={s}
              href={`#/result?s=${s}`}
              className={`chip ${activeStatus === s ? 'active' : ''}`}
              aria-current={activeStatus === s ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                sessionStorage.removeItem('wase_verify_jws');
                navigate('result', { s });
              }}
            >
              {t(`r_${s}_t`)}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
