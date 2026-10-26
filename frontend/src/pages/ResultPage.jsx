import React, { useState, useEffect } from 'react';
import { verifyDocumentCredential } from '../crypto.js';
import { keyStore, drlStore, auditStore } from '../storage.js';
import { fetchApi } from '../api-config.js';


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

const EMPTY_DOC = {
  type: '',
  holder: '—',
  holderId: '',
  issuer: '—',
  docId: '—',
  issued: '—',
  expires: '—'
};

export default function ResultPage({ routeParams, navigate }) {
  const [activeStatus, setActiveStatus] = useState(() => {
    if (routeParams?.s && RESULTS_CONFIG[routeParams.s]) return routeParams.s;
    return 'valid';
  });

  const [docData, setDocData] = useState(routeParams?.doc || EMPTY_DOC);
  const [customCfg, setCustomCfg] = useState(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);

  useEffect(() => {
    async function evaluate() {
      if (routeParams?.doc) {
        setDocData(routeParams.doc);
        if (routeParams.s) setActiveStatus(routeParams.s);
        return;
      }

      const jws = routeParams?.jws || sessionStorage.getItem('wase_verify_jws');
      const docId = routeParams?.id;

      if (jws) {
        try {
          const verification = await verifyDocumentCredential(jws, keyStore, drlStore);
          await auditStore.addRecord(verification.docId || 'unknown', verification.status);

          // Check 1: JWS signature check ALWAYS runs first. Tampered hides details and stops.
          if (verification.status === 'TAMPERED') {
            setActiveStatus('tampered');
            setDocData(EMPTY_DOC);
            return;
          }

          if (verification.status === 'UNREADABLE') {
            setActiveStatus('error');
            setDocData(EMPTY_DOC);
            return;
          }

          const payload = verification.payload || {};
          const targetDocId = verification.docId || payload.doc_id || payload.id;

          // Check 2: Online record fetch
          let isOnline = navigator.onLine;
          let dbRecord = null;
          let notInRecords = false;

          if (isOnline) {
            try {
              const res = await fetchApi(`/api/v1/documents/${encodeURIComponent(targetDocId)}`);
              if (res.status === 404) {
                notInRecords = true;
              } else if (res.ok) {
                dbRecord = await res.json();
              } else {
                isOnline = false;
              }
            } catch (netErr) {
              isOnline = false;
            }
          }

          if (notInRecords) {
            setActiveStatus('error');
            setCustomCfg({
              k: 'error',
              title: 'Not in records',
              desc: 'This document is not in the WaseNet records. Do not accept it until it is confirmed.',
              note: 'This document is not in the WaseNet records. Do not accept it until it is confirmed.',
              f: 0
            });
            setDocData(EMPTY_DOC);
            return;
          }

          if (isOnline && dbRecord) {
            const normType = (t) => String(t || '').toLowerCase().replace(/[\s_-]+/g, '');
            const typeMatch = normType(dbRecord.doc_type) === normType(payload.doc_type || payload.type);
            const idMatch = String(dbRecord.id).toLowerCase() === String(targetDocId).toLowerCase();
            const nameMatch = String(dbRecord.holder_name || '').trim().toLowerCase() === String(payload.holder_name || '').trim().toLowerCase();
            const expMatch = String(dbRecord.expiry_date || '').split('T')[0] === String(payload.expiry_date || payload.expires_at || '').split('T')[0];

            if (!typeMatch || !idMatch || !nameMatch || !expMatch) {
              setActiveStatus('tampered');
              setCustomCfg({
                k: 'tampered',
                title: 'Tampered',
                desc: 'This document failed the signature check. Do not accept it.',
                note: "This document's details do not match its signed record.",
                f: 0
              });
              setDocData(EMPTY_DOC);
              return;
            }

            let isRevoked = dbRecord.sync_state === 'revoked';
            if (!isRevoked) {
              try {
                const revRes = await fetchApi('/api/v1/revocations');
                if (revRes.ok) {
                  const revData = await revRes.json();
                  isRevoked = (revData.delta || []).some((r) => r.doc_id === targetDocId);
                }
              } catch (e) {}
            }

            if (isRevoked) {
              setActiveStatus('revoked');
            } else {
              const expDate = new Date(dbRecord.expiry_date);
              if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
                setActiveStatus('expired');
              } else {
                setActiveStatus('valid');
              }
            }

            setDocData({
              type: dbRecord.doc_type || '',
              holder: dbRecord.holder_name || '—',
              holderId: dbRecord.holder_national_id || '',
              issuer: dbRecord.issuer_code || 'ET-AA-DOC-01',
              docId: dbRecord.id || targetDocId,
              issued: dbRecord.issue_date ? String(dbRecord.issue_date).split('T')[0] : '—',
              expires: dbRecord.expiry_date ? String(dbRecord.expiry_date).split('T')[0] : '—'
            });
            setIsOfflineResult(false);
            return;
          }

          // Offline fallback
          setIsOfflineResult(true);
          const isRevOffline = await drlStore.isRevoked(targetDocId);
          if (isRevOffline) {
            setActiveStatus('revoked');
          } else {
            const expDate = new Date(payload.expiry_date || payload.expires_at);
            if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
              setActiveStatus('expired');
            } else {
              setActiveStatus('valid');
            }
          }

          setDocData({
            type: payload.doc_type || payload.type || '',
            holder: payload.holder_name || payload.holder || '—',
            holderId: '', // Server-only detail; hidden offline
            issuer: payload.issuer_code || payload.issuer_id || 'ET-AA-DOC-01',
            docId: targetDocId,
            issued: payload.issue_date ? String(payload.issue_date).split('T')[0] : '—',
            expires: payload.expiry_date ? String(payload.expiry_date).split('T')[0] : '—'
          });
        } catch (err) {
          setActiveStatus('error');
          setDocData(EMPTY_DOC);
        }
      } else if (docId) {
        try {
          const res = await fetchApi(`/api/v1/documents/${encodeURIComponent(docId)}`);
          if (res.status === 404) {
            setActiveStatus('error');
            setCustomCfg({
              k: 'error',
              title: 'Not in records',
              desc: 'This document is not in the WaseNet records. Do not accept it until it is confirmed.',
              note: 'This document is not in the WaseNet records. Do not accept it until it is confirmed.',
              f: 0
            });
            setDocData(EMPTY_DOC);
            return;
          }
          if (res.ok) {
            const dbRecord = await res.json();
            setActiveStatus(dbRecord.sync_state === 'revoked' ? 'revoked' : 'valid');
            setDocData({
              type: dbRecord.doc_type || '',
              holder: dbRecord.holder_name || '—',
              holderId: dbRecord.holder_national_id || '',
              issuer: dbRecord.issuer_code || 'ET-AA-DOC-01',
              docId: dbRecord.id || docId,
              issued: dbRecord.issue_date ? String(dbRecord.issue_date).split('T')[0] : '—',
              expires: dbRecord.expiry_date ? String(dbRecord.expiry_date).split('T')[0] : '—'
            });
            return;
          }
        } catch (e) {
          setActiveStatus('error');
          setDocData(EMPTY_DOC);
        }
      } else {
        setDocData(EMPTY_DOC);
      }
    }

    evaluate();
  }, [routeParams?.jws, routeParams?.id, routeParams?.s, routeParams?.doc]);

  const verifySource = routeParams?.source || sessionStorage.getItem('wase_verify_source') || (routeParams?.id ? 'id' : 'scan');

  const baseCfg = customCfg || RESULTS_CONFIG[activeStatus] || RESULTS_CONFIG.valid;
  const cfg = (activeStatus === 'error' && !customCfg)
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
    ...(!isOfflineResult && docData.holderId ? [['Holder national ID (FAN)', formatNationalId(docData.holderId)]] : []),
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

      {isOfflineResult && (
        <div className="note" style={{ marginTop: '14px', textAlign: 'center', fontWeight: 700, color: 'var(--warn-bg)' }}>
          Checked on this device. Not confirmed online.
        </div>
      )}

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
    </div>
  );
}
