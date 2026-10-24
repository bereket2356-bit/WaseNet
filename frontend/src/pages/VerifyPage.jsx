import React, { useState, useRef, useEffect } from 'react';
import { getSampleTokens } from '../sample-docs.js';
import { getCurrentUser } from '../auth.js';
import { auditStore } from '../storage.js';

let jsqrPromise = null;
function loadJsQR() {
  if (typeof window !== 'undefined' && window.jsQR) {
    return Promise.resolve(window.jsQR);
  }
  if (!jsqrPromise) {
    jsqrPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Pinned version 1.4.0 from cdnjs
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
      script.async = true;
      script.onload = () => {
        if (window.jsQR) resolve(window.jsQR);
        else reject(new Error('jsQR not found'));
      };
      script.onerror = () => {
        // Fallback for offline mode (service worker cached /lib/jsqr.js)
        const localScript = document.createElement('script');
        localScript.src = '/lib/jsqr.js';
        localScript.async = true;
        localScript.onload = () => {
          if (window.jsQR) resolve(window.jsQR);
          else reject(new Error('Failed to load local jsQR fallback'));
        };
        localScript.onerror = () => reject(new Error('Failed to load jsQR'));
        document.head.appendChild(localScript);
      };
      document.head.appendChild(script);
    });
  }
  return jsqrPromise;
}

async function decodeQrCodeFromFile(file) {
  const jsQR = await loadJsQR();
  if (!jsQR) throw new Error('Decoder unavailable');

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = objectUrl;
    });

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    if (!origW || !origH) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tryDecode = (w, h) => {
      const imgData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) return code.data;
      return null;
    };

    // Attempt 1: Full-res (clamped at 1600px max for speed)
    let w1 = origW;
    let h1 = origH;
    const maxDim = 1600;
    if (w1 > maxDim || h1 > maxDim) {
      const r = Math.min(maxDim / w1, maxDim / h1);
      w1 = Math.max(1, Math.round(w1 * r));
      h1 = Math.max(1, Math.round(h1 * r));
    }
    canvas.width = w1;
    canvas.height = h1;
    ctx.drawImage(img, 0, 0, w1, h1);
    let result = tryDecode(w1, h1);
    if (result) {
      canvas.width = 0;
      canvas.height = 0;
      return result;
    }

    // Attempt 2: Downscaled copy (clamped to 800px max or 0.5 scale)
    const scale = Math.min(800 / origW, 800 / origH, 0.5);
    const w2 = Math.max(1, Math.round(origW * scale));
    const h2 = Math.max(1, Math.round(origH * scale));
    if (w2 !== w1 || h2 !== h1) {
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(img, 0, 0, w2, h2);
      result = tryDecode(w2, h2);
      if (result) {
        canvas.width = 0;
        canvas.height = 0;
        return result;
      }
    }

    // Attempt 3: Grayscale copy
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    const codeGray = jsQR(d, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (codeGray && codeGray.data) {
      canvas.width = 0;
      canvas.height = 0;
      return codeGray.data;
    }

    canvas.width = 0;
    canvas.height = 0;
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function VerifyPage({ navigate }) {
  const [isScanning, setIsScanning] = useState(false);
  const [docIdInput, setDocIdInput] = useState('');
  const [sampleTokens, setSampleTokens] = useState(null);
  const [scannerError, setScannerError] = useState(null);

  // Choose a file state
  const [isDecoding, setIsDecoding] = useState(false);
  const [fileError, setFileError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const fileInputRef = useRef(null);

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
      await loadJsQR();
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
          sessionStorage.setItem('wase_verify_source', 'scan');
          sessionStorage.setItem('wase_verify_jws', code.data);
          navigate('result', { jws: code.data, source: 'scan' });
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');
    setAnnouncement('');

    // 1. Max size: 10 MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const msg = 'This file is too large. Choose a file under 10 MB.';
      setFileError(msg);
      setAnnouncement(msg);
      e.target.value = '';
      return;
    }

    // 2. Allowed types: JPG, PNG, WebP
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const fileName = file.name || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    const isAllowedType = allowedMime.includes(file.type) || isAllowedExt;

    if (!isAllowedType) {
      const msg = 'Choose a JPG, PNG, or WebP image.';
      setFileError(msg);
      setAnnouncement(msg);
      e.target.value = '';
      return;
    }

    setIsDecoding(true);
    setAnnouncement('Reading the QR code...');

    try {
      const decodedText = await decodeQrCodeFromFile(file);
      if (decodedText) {
        setAnnouncement('QR code read successfully.');
        sessionStorage.setItem('wase_verify_source', 'upload');
        sessionStorage.setItem('wase_verify_jws', decodedText);
        navigate('result', { jws: decodedText, source: 'upload' });
      } else {
        setAnnouncement('Could not read QR code.');
        sessionStorage.setItem('wase_verify_source', 'upload');
        sessionStorage.removeItem('wase_verify_jws');
        navigate('result', { s: 'error', source: 'upload' });
      }
    } catch (err) {
      setAnnouncement('Could not read QR code.');
      sessionStorage.setItem('wase_verify_source', 'upload');
      sessionStorage.removeItem('wase_verify_jws');
      navigate('result', { s: 'error', source: 'upload' });
    } finally {
      setIsDecoding(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleIdSubmit = (e) => {
    e.preventDefault();
    const id = docIdInput.trim();
    if (id) {
      sessionStorage.setItem('wase_verify_source', 'id');
      navigate('result', { id, source: 'id' });
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

            <div style={{ marginTop: '14px' }}>
              <input
                ref={fileInputRef}
                id="qr-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn outline block"
                id="choose-file-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDecoding}
                aria-describedby={`file-hint file-privacy${fileError ? ' file-err' : ''}${isDecoding ? ' file-loading' : ''}`}
                style={{ minHeight: '48px', width: '100%' }}
              >
                Choose a file
              </button>

              <p id="file-hint" className="muted" style={{ margin: '10px 0 4px', fontSize: '13px' }}>
                Use a clear photo or scan of the QR code. JPG, PNG, or WebP.
              </p>
              <p id="file-privacy" className="muted" style={{ margin: '0 0 4px', fontSize: '12px' }}>
                Your file stays on this device.
              </p>

              {isDecoding && (
                <p id="file-loading" className="muted" style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: 600 }}>
                  Reading the QR code...
                </p>
              )}

              {fileError && (
                <p id="file-err" className="err" role="alert" style={{ margin: '8px 0 0', fontSize: '13px' }}>
                  {fileError}
                </p>
              )}

              <div id="file-live-region" className="sr-only" aria-live="polite">
                {announcement}
              </div>
            </div>
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
          <div className="toolbar">
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
