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
  const offscreenCanvasRef = useRef(document.createElement('canvas'));

  useEffect(() => {
    getSampleTokens().then((tokens) => setSampleTokens(tokens));

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
      setScannerError('Camera access denied or unavailable. Please use file upload or sample buttons.');
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
      if ('BarcodeDetector' in window) {
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
      if (window.jsQR) {
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

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Try BarcodeDetector
        if ('BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const codes = await detector.detect(img);
            if (codes.length > 0) {
              onScanned(codes[0].rawValue);
              return;
            }
          } catch (err) {}
        }
        // Try jsQR
        if (window.jsQR) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, img.width, img.height);
          const code = window.jsQR(data.data, data.width, data.height);
          if (code && code.data) {
            onScanned(code.data);
            return;
          }
        }
        alert('Could not read a QR code from this image. Please ensure the code is clear and well-lit.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container-narrow">
      <h1>{t('verify.heading')}</h1>
      <p className="muted-text">{t('verify.subheading')}</p>

      {/* Active Camera Viewfinder Overlay */}
      {isScanning && (
        <div className="panel panel-alt" role="region" aria-label="Camera viewfinder" style={{ padding: '16px' }}>
          <div className="scanner-viewport-active">
            <div className="scanner-container">
              <video ref={videoRef} className="scanner-video" playsInline></video>
              <div className="scanner-overlay">
                <div className="scanner-instruction">{t('verify.camera_instruction')}</div>
                <div className="scanner-guide-box"></div>
              </div>
            </div>

            <div className="scanner-controls" style={{ width: '100%', maxWidth: '440px' }}>
              <button
                onClick={stopCamera}
                className="btn btn-secondary btn-full"
                style={{ minHeight: '48px' }}
              >
                {t('verify.btn_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Action Panel */}
      {!isScanning && (
        <div className="panel">
          {scannerError && (
            <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
              {scannerError}
            </div>
          )}

          <button
            onClick={startCamera}
            className="btn btn-primary btn-full"
            style={{ marginBottom: 'var(--space-5)', minHeight: '52px', fontSize: '1.05rem' }}
          >
            {t('verify.btn_scan')}
          </button>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-rule)', margin: 'var(--space-5) 0' }} />

          {/* Secondary Form: Enter Document ID */}
          <h2 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>
            {t('verify.or_title')}
          </h2>
          <form onSubmit={handleIdSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="input-doc-id" className="form-label">
                {t('verify.id_label')}
              </label>
              <input
                type="text"
                id="input-doc-id"
                value={docIdInput}
                onChange={(e) => setDocIdInput(e.target.value)}
                className="form-input"
                placeholder={t('verify.id_placeholder')}
                inputMode="text"
                autoComplete="off"
                required
              />
              <span className="form-hint">{t('verify.id_hint')}</span>
            </div>

            <button type="submit" className="btn btn-secondary btn-full" style={{ minHeight: '48px' }}>
              {t('verify.btn_check_id')}
            </button>
          </form>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-rule)', margin: 'var(--space-5) 0' }} />

          {/* File Upload Fallback */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="qr-file-input" className="form-label">
              {t('verify.upload_qr')}
            </label>
            <input
              type="file"
              id="qr-file-input"
              accept="image/*"
              onChange={handleFileUpload}
              className="form-input"
              style={{ padding: '8px', minHeight: '44px' }}
            />
          </div>

          {/* Test Fixtures for Evaluators */}
          {sampleTokens && (
            <div>
              <p className="muted-text" style={{ fontSize: '0.88rem', marginBottom: 'var(--space-2)' }}>
                {t('verify.or_samples')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onScanned(sampleTokens.valid)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', minHeight: '44px', padding: '6px 12px' }}
                >
                  {t('verify.sample_valid')}
                </button>
                <button
                  type="button"
                  onClick={() => onScanned(sampleTokens.tampered)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', minHeight: '44px', padding: '6px 12px' }}
                >
                  {t('verify.sample_tampered')}
                </button>
                <button
                  type="button"
                  onClick={() => onScanned(sampleTokens.revoked)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', minHeight: '44px', padding: '6px 12px' }}
                >
                  {t('verify.sample_revoked')}
                </button>
                <button
                  type="button"
                  onClick={() => onScanned(sampleTokens.expired)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', minHeight: '44px', padding: '6px 12px' }}
                >
                  {t('verify.sample_expired')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
