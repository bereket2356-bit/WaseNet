import React, { useState, useEffect } from 'react';
import { verifyDocumentCredential } from '../crypto.js';
import { keyStore, drlStore, auditStore } from '../storage.js';

const RESULTS_CONFIG = {
  valid: {
    k: 'valid',
    title: 'Valid',
    desc: 'Authentic and current.',
    f: 1
  },
  tampered: {
    k: 'tampered',
    title: 'Tampered',
    desc: 'This document failed the signature check. Do not accept it.',
    note: 'Details are hidden because the signature did not match.',
    f: 0
  },
  revoked: {
    k: 'revoked',
    title: 'Revoked',
    desc: 'This document has been cancelled by the issuing office.',
    f: 1
  },
  expired: {
    k: 'expired',
    title: 'Expired',
    desc: 'The signature is genuine, but this document is past its expiry date.',
    f: 1
  },
  error: {
    k: 'error',
    title: 'Could not read',
    desc: 'This QR code could not be read. Try again with better lighting.',
    note: 'Hold the phone steady and keep the whole code inside the frame.',
    f: 0
  }
};

const ERROR_MESSAGES = {
  scan: {
    title: 'Could not read',
    desc: 'This QR code could not be read from the camera. Try again with better lighting.',
    note: 'Hold the phone steady and keep the whole code inside the frame.'
  },
  upload: {
    title: 'Could not read',
    desc: 'This QR code could not be read from the uploaded image. Choose a clearer file and try again.',
    note: 'Use a clear photo or scan of the QR code. Ensure the code is in focus, well-lit, and not cropped.'
  },
  id: {
    title: 'Could not read',
    desc: 'This document ID could not be found or verified. Check the document number and try again.',
    note: 'Ensure the document ID is entered correctly, including all hyphens and characters.'
  }
};

const DOC_TYPES = {
  dt_land: 'Land certificate',
  dt_coop: 'Cooperative credential',
  dt_birth: 'Birth record',
  dt_permit: 'Local permit'
};

function formatNationalId(val) {
  if (!val) return '—';
  const clean = String(val).replace(/\D/g, '').slice(0, 16);
  if (clean.length === 16) {
    return clean.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1-$2-$3-$4');
  }
  return String(val);
}

const DEFAULT_DOC = {
  type: 'dt_land',
  holder: 'Abebe Bikila',
  holderId: '1024589234017685',
  issuer: 'KEBELE-04-AA',
  docId: '550e8400-e29b-41d4-a716-446655440000',
  issued: '1 Oct 2026',
  expires: '1 Oct 2028'
};

export default function ResultPage({ routeParams, navigate }) {
  const [activeStatus, setActiveStatus] = useState(() => {
    if (routeParams?.s && RESULTS_CONFIG[routeParams.s]) return routeParams.s;
    return 'valid';
  });

  const [docData, setDocData] = useState(DEFAULT_DOC);

  useEffect(() => {
    async function evaluate() {
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
              type: p.type || DEFAULT_DOC.type,
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
  }, [routeParams?.jws, routeParams?.id, routeParams?.s]);

  const verifySource = routeParams?.source || sessionStorage.getItem('wase_verify_source') || (routeParams?.id ? 'id' : 'scan');

  const baseCfg = RESULTS_CONFIG[activeStatus] || RESULTS_CONFIG.valid;
  const cfg = activeStatus === 'error'
    ? {
        ...baseCfg,
        ...(ERROR_MESSAGES[verifySource] || ERROR_MESSAGES.scan)
      }
    : baseCfg;

  const isDetailsVisible = cfg.f === 1;

  const displayType = DOC_TYPES[docData.type] || docData.type;

  const fields = [
    ['Document type', displayType],
    ['Holder name', docData.holder],
    ['Holder national ID (FAN)', formatNationalId(docData.holderId)],
    ['Issuer code', docData.issuer],
    ['Document ID', docData.docId],
    ['Issued', docData.issued],
    ['Expires', docData.expires]
  ];

  return (
    <div className="verify-wrap" style={{ paddingTop: '28px', paddingBottom: '32px' }}>
      <section className="banner" data-s={cfg.k} role="status">
        <h2>{cfg.title}</h2>
        <p>{cfg.desc}</p>
      </section>

      {isDetailsVisible && (
        <section className="card" style={{ marginTop: '16px' }}>
          <dl className="rows">
            {fields.map(([lbl, val]) => (
              <div key={lbl}>
                <dt>{lbl}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {cfg.note && (
        <p className="note" style={{ marginTop: '16px' }}>
          {cfg.note}
        </p>
      )}

      <div className="row-btns" style={{ marginTop: '24px', justifyContent: 'center' }}>
        <a
          className="btn"
          href="#/verify"
          onClick={(e) => {
            e.preventDefault();
            navigate('verify');
          }}
        >
          {verifySource === 'upload' ? 'Upload another file' : verifySource === 'id' ? 'Check another document' : 'Scan another document'}
        </a>

        {(cfg.k === 'tampered' || cfg.k === 'revoked') && (
          <a
            className="btn outline danger"
            href={`#/report?docid=${encodeURIComponent(docData.docId || '')}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('report', { docid: docData.docId || '' });
            }}
          >
            Report a fraud
          </a>
        )}

        {cfg.k === 'error' && (
          <a
            className="btn outline"
            href="#/contact"
            onClick={(e) => {
              e.preventDefault();
              navigate('contact');
            }}
          >
            Contact us
          </a>
        )}
      </div>

      <div className="stack" style={{ marginTop: '36px', textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: '15px' }}>
          Preview another result
        </p>
        <div className="chips" style={{ justifyContent: 'center' }}>
          {Object.keys(RESULTS_CONFIG).map((s) => (
            <a
              key={s}
              href={`#/result?s=${s}`}
              className={`chip ${activeStatus === s ? 'active' : ''}`}
              aria-current={activeStatus === s ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                sessionStorage.removeItem('wase_verify_jws');
                sessionStorage.removeItem('wase_verify_source');
                navigate('result', { s });
              }}
            >
              {RESULTS_CONFIG[s].title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
