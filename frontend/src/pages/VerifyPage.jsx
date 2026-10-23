import React, { useState, useRef, useEffect } from 'react';
import { getSampleTokens } from '../sample-docs.js';
import { getCurrentUser } from '../auth.js';
import { auditStore } from '../storage.js';

export default function VerifyPage({ navigate }) {
  const [isScanning, setIsScanning] = useState(false);
  const [docIdInput, setDocIdInput] = useState('');
  const [sampleTokens, setSampleTokens] = useState(null);
  const [scannerError, setScannerError] = useState(null);

  const [user, setUser] = useState(getCurrentUser());
  const [recentChecks, setRecentChecks] = useState([]);
  const [auditFilter, setAuditFilter] = useState('all');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const offscreenCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);

  const loadAudit = async (f = auditFilter) => {
    try {
      const list = await auditStore.getRecords(f === 'all' ? 'All' : f);
      setRecentChecks(list || []);
    } catch (e) {}
  };

  useEffect(() => {
    getSampleTokens().then((tokens) => setSampleTokens(tokens)).catch(() => {});

    const handleAuthChange = () => {
      const u = getCurrentUser();
      setUser(u);
      if (u) loadAudit();
    };

    window.addEventListener('authchange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    if (user) {
      loadAudit(auditFilter);
    }

    return () => {
      window.removeEventListener('authchange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadAudit(auditFilter);
    }
  }, [auditFilter, user]);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startCamera = async () => {
    setScannerError(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanLoop();
      }
    } catch (err) {
      setScannerError('Camera unavailable. Tap below to test with a verified sample.');
      setIsScanning(false);
    }
  };

  const scanLoop = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const canvas = offscreenCanvasRef.current;
    if (canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (window.jsQR) {
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          stopCamera();
          sessionStorage.setItem('wase_verify_jws', code.data);
          navigate('result', { jws: code.data });
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const handleIdSubmit = (e) => {
    e.preventDefault();
    const id = docIdInput.trim();
    if (id) {
      navigate('result', { id });
    }
  };

  return (
    <div className="verify-wrap">
      <header className="page-intro">
        <h1>Scan a document</h1>
        <p className="intro">
          Hold the QR code inside the frame.
        </p>
      </header>

      <div className="card scan" style={{ marginTop: '0px' }}>
        {!isScanning ? (
          <>
            <a
              className="btn scan-btn block"
              href="#/result?s=valid"
              onClick={async (e) => {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                  e.preventDefault();
                  try {
                    await startCamera();
                  } catch (err) {
                    navigate('result', { s: 'valid' });
                  }
                }
              }}
            >
              Scan a document
            </a>
            {scannerError && (
              <div style={{ marginTop: '12px' }}>
                <p className="err" style={{ marginBottom: '10px' }}>{scannerError}</p>
                <a
                  className="btn outline sm"
                  href="#/result?s=valid"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('result', { s: 'valid' });
                  }}
                >
                  Scan a document (Demo)
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="stack" style={{ textAlign: 'center' }}>
            <div className="scanner-video-box">
              <video ref={videoRef} playsInline autoPlay muted />
            </div>
            <p className="scan-hint muted">Hold the QR code inside the frame.</p>
            <div>
              <button
                className="btn outline sm"
                type="button"
                onClick={stopCamera}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="or">or enter a document ID</div>

      <form id="f-id" className="card" onSubmit={handleIdSubmit}>
        <label className="field">
          <span>Document ID</span>
          <input
            name="docid"
            value={docIdInput}
            onChange={(e) => setDocIdInput(e.target.value)}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            autoComplete="off"
            required
          />
        </label>
        <p className="muted" style={{ margin: '8px 0 16px', fontSize: '15px' }}>
          Checking revocation needs a connection.
        </p>
        <button className="btn outline block" type="submit">
          Check this ID
        </button>
      </form>

      {user && (
        <section className="card" style={{ marginTop: '36px' }}>
          <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.4rem' }}>Recent checks</h2>
            <label className="field" style={{ margin: 0, minWidth: '180px' }}>
              <span className="muted" style={{ fontSize: '14px', fontWeight: 700 }}>
                Filter by result
              </span>
              <select
                id="filter"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="valid">Valid</option>
                <option value="tampered">Tampered</option>
                <option value="revoked">Revoked</option>
                <option value="expired">Expired</option>
              </select>
            </label>
          </div>
          {recentChecks.length > 0 ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Document ID</th>
                    <th>Time</th>
                    <th>Result</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {recentChecks.slice(0, 10).map((a, idx) => (
                    <tr key={idx}>
                      <td style={{ wordBreak: 'break-all' }}>{a.doc_id || a.id}</td>
                      <td>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (a.time || '—')}</td>
                      <td>
                        <span className={`pill ${a.result === 'VALID' ? 'p-ok' : a.result === 'TAMPERED' || a.result === 'REVOKED' ? 'p-bad' : 'p-warn'}`}>
                          {a.result}
                        </span>
                      </td>
                      <td>{a.deviceId || a.device || 'wase-dev-01'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty muted" style={{ textAlign: 'center', padding: '16px' }}>
              No verifications recorded on this device yet.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
