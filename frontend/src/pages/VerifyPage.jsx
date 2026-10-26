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

let pdfjsPromise = null;
function loadPdfJs() {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdf.js unavailable'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load pdf.js'));
      document.head.appendChild(script);
    });
  }
  return pdfjsPromise;
}

async function decodePdfFile(file, jsQR) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  let pdfDoc;
  try {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    const openErr = new Error('This PDF could not be opened. Try a photo or a scan of the document.');
    openErr.code = 'PDF_OPEN_ERROR';
    throw openErr;
  }

  try {
    const maxPages = Math.min(pdfDoc.numPages, 3);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Attempt 1: Full frame
      let code = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        canvas.width = 0; canvas.height = 0;
        return code.data;
      }

      // Attempt 2: Centered crop (central 70%)
      const cw = Math.max(1, Math.round(canvas.width * 0.7));
      const ch = Math.max(1, Math.round(canvas.height * 0.7));
      const cx = Math.max(0, Math.round((canvas.width - cw) / 2));
      const cy = Math.max(0, Math.round((canvas.height - ch) / 2));
      const cropImgData = ctx.getImageData(cx, cy, cw, ch);
      code = jsQR(cropImgData.data, cw, ch, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        canvas.width = 0; canvas.height = 0;
        return code.data;
      }

      // Attempt 3: Downscaled copy
      const dw = Math.floor(canvas.width / 2);
      const dh = Math.floor(canvas.height / 2);
      const downCanvas = document.createElement('canvas');
      downCanvas.width = dw;
      downCanvas.height = dh;
      const dctx = downCanvas.getContext('2d');
      dctx.drawImage(canvas, 0, 0, dw, dh);
      const downImgData = dctx.getImageData(0, 0, dw, dh);
      code = jsQR(downImgData.data, dw, dh, { inversionAttempts: 'dontInvert' });
      downCanvas.width = 0; downCanvas.height = 0;
      if (code && code.data) {
        canvas.width = 0; canvas.height = 0;
        return code.data;
      }

      // Attempt 4: Inverted copy
      const invData = new Uint8ClampedArray(imgData.data);
      for (let i = 0; i < invData.length; i += 4) {
        invData[i] = 255 - invData[i];
        invData[i + 1] = 255 - invData[i + 1];
        invData[i + 2] = 255 - invData[i + 2];
      }
      code = jsQR(invData, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      canvas.width = 0; canvas.height = 0;
      if (code && code.data) {
        return code.data;
      }
    }
    return null;
  } finally {
    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy();
    }
  }
}

async function decodeQrCodeFromFile(file) {
  const jsQR = await loadJsQR();
  if (!jsQR) throw new Error('Decoder unavailable');

  if (file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) {
    return await decodePdfFile(file, jsQR);
  }

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

    // Attempt 1: Full frame (clamped to 1600px max for speed)
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
    let fullImgData = ctx.getImageData(0, 0, w1, h1);
    let code = jsQR(fullImgData.data, w1, h1, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      canvas.width = 0; canvas.height = 0;
      return code.data;
    }

    // Attempt 2: Centered crop (central 70% where the QR code sits)
    const cropRatio = 0.7;
    const cw = Math.max(1, Math.round(w1 * cropRatio));
    const ch = Math.max(1, Math.round(h1 * cropRatio));
    const cx = Math.max(0, Math.round((w1 - cw) / 2));
    const cy = Math.max(0, Math.round((h1 - ch) / 2));
    const cropImgData = ctx.getImageData(cx, cy, cw, ch);
    code = jsQR(cropImgData.data, cw, ch, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      canvas.width = 0; canvas.height = 0;
      return code.data;
    }

    // Attempt 3: Downscaled copy (clamped to 800px max or 0.5 scale)
    const scale = Math.min(800 / origW, 800 / origH, 0.5);
    const w2 = Math.max(1, Math.round(origW * scale));
    const h2 = Math.max(1, Math.round(origH * scale));
    if (w2 !== w1 || h2 !== h1) {
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(img, 0, 0, w2, h2);
      const downImgData = ctx.getImageData(0, 0, w2, h2);
      code = jsQR(downImgData.data, w2, h2, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        canvas.width = 0; canvas.height = 0;
        return code.data;
      }
    }

    // Attempt 4: Inverted copy (inverts pixels for dark/inverted codes)
    const invData = new Uint8ClampedArray(fullImgData.data);
    for (let i = 0; i < invData.length; i += 4) {
      invData[i] = 255 - invData[i];
      invData[i + 1] = 255 - invData[i + 1];
      invData[i + 2] = 255 - invData[i + 2];
    }
    code = jsQR(invData, w1, h1, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      canvas.width = 0; canvas.height = 0;
      return code.data;
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
    if (canvas && window.jsQR) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, vw, vh);
      const fullImg = ctx.getImageData(0, 0, vw, vh);

      let found = null;
      // 1. Full frame
      let code = window.jsQR(fullImg.data, vw, vh, { inversionAttempts: 'dontInvert' });
      if (code && code.data) found = code.data;

      // 2. Centered crop (central 70%)
      if (!found) {
        const cw = Math.max(1, Math.round(vw * 0.7));
        const ch = Math.max(1, Math.round(vh * 0.7));
        const cx = Math.max(0, Math.round((vw - cw) / 2));
        const cy = Math.max(0, Math.round((vh - ch) / 2));
        const cropImg = ctx.getImageData(cx, cy, cw, ch);
        code = window.jsQR(cropImg.data, cw, ch, { inversionAttempts: 'dontInvert' });
        if (code && code.data) found = code.data;
      }

      // 3. Downscaled copy
      if (!found && (vw > 600 || vh > 600)) {
        const sw = Math.round(vw / 2);
        const sh = Math.round(vh / 2);
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(video, 0, 0, sw, sh);
        const downImg = ctx.getImageData(0, 0, sw, sh);
        code = window.jsQR(downImg.data, sw, sh, { inversionAttempts: 'dontInvert' });
        if (code && code.data) found = code.data;
      }

      // 4. Inverted copy
      if (!found) {
        const invData = new Uint8ClampedArray(fullImg.data);
        for (let i = 0; i < invData.length; i += 4) {
          invData[i] = 255 - invData[i];
          invData[i + 1] = 255 - invData[i + 1];
          invData[i + 2] = 255 - invData[i + 2];
        }
        code = window.jsQR(invData, vw, vh, { inversionAttempts: 'dontInvert' });
        if (code && code.data) found = code.data;
      }

      if (found) {
        stopCamera();
        sessionStorage.setItem('wase_verify_source', 'scan');
        sessionStorage.setItem('wase_verify_jws', found);
        navigate('result', { jws: found, source: 'scan' });
        return;
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

    // 2. Allowed types: JPG, PNG, WebP, PDF
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const fileName = file.name || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext);
    const isAllowedType = allowedMime.includes(file.type) || isAllowedExt;

    if (!isAllowedType) {
      const msg = 'Choose a JPG, PNG, WebP, or PDF file.';
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
      if (err?.code === 'PDF_OPEN_ERROR' || err?.message?.includes('could not be opened')) {
        const msg = 'This PDF could not be opened. Try a photo or a scan of the document.';
        setFileError(msg);
        setAnnouncement(msg);
        return;
      }
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
            <button
              type="button"
              className="btn scan-btn block"
              onClick={async () => {
                try {
                  await startCamera();
                } catch (err) {
                  // Error is captured in scannerError state; do not navigate to demo result
                }
              }}
            >
              Scan a document
            </button>
            {scannerError && (
              <div style={{ marginTop: '12px' }}>
                <p className="err" style={{ marginBottom: '10px' }}>{scannerError}</p>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <input
                ref={fileInputRef}
                id="qr-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
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
                JPG, PNG, WebP, or PDF. Your file stays on this device.
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
