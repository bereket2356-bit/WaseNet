import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getSampleTokens } from '../sample-docs.js';

export default function VerifyPage({ navigate }) {
  const { t } = useI18n();
  const [isScanning, setIsScanning] = useState(false);
  const [docIdInput, setDocIdInput] = useState('');
  const [sampleTokens, setSampleTokens] = useState(null);
  const [scannerError, setScannerError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const offscreenCanvasRef = useRef(typeof document !== 'undefined' ? document.createElement('canvas') : null);

  useEffect(() => {
    getSampleTokens().then((tokens) => setSampleTokens(tokens)).catch(() => {});

    return () => {
      stopCamera();
    };
  }, []);

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

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width > 0 && height > 0) {
      // 1. Hardware accelerated BarcodeDetector
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            stopCamera();
            onScanned(raw);
            return;
          }
        } catch (e) {}
      }

      // 2. jsQR offline fallback
      if (typeof window !== 'undefined' && window.jsQR && offscreenCanvasRef.current) {
        const canvas = offscreenCanvasRef.current;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          stopCamera();
          onScanned(code.data);
          return;
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  const onScanned = (tokenOrId) => {
    sessionStorage.setItem('wase_verify_jws', tokenOrId);
    navigate('result', { jws: tokenOrId });
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
      <h1>{t('verify_title')}</h1>
      <p className="muted" style={{ marginTop: '10px' }}>
        {t('verify_hint')}
      </p>

      <div className="card scan" style={{ marginTop: '28px' }}>
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
              {t('verify_title')}
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
                  {t('cta_scan')} (Demo)
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="stack" style={{ textAlign: 'center' }}>
            <div className="scanner-video-box">
              <video ref={videoRef} playsInline autoPlay muted />
            </div>
            <p className="scan-hint muted">{t('verify_hint')}</p>
            <div>
              <button
                className="btn outline sm"
                type="button"
                onClick={stopCamera}
              >
                {t('cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="or">{t('verify_or')}</div>

      <form id="f-id" className="card" onSubmit={handleIdSubmit}>
        <label className="field">
          <span>{t('f_docid')}</span>
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
          {t('verify_id_hint')}
        </p>
        <button className="btn outline block" type="submit">
          {t('check_id')}
        </button>
      </form>
    </div>
  );
}
