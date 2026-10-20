import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser, getToken } from '../auth.js';
import { getSigningProvider, IsolatedMockHardwareSigningProvider } from '../signing-provider.js';
import { queueStore } from '../storage.js';

export default function IssuePage({ navigate }) {
  const { t } = useI18n();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [signing, setSigning] = useState(false);
  const [formError, setFormError] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});

  const generateUuid = () => {
    return crypto.randomUUID ? crypto.randomUUID() : '550e8400-e29b-41d4-a716-' + Math.random().toString(36).substring(2, 14);
  };

  const today = new Date().toISOString().split('T')[0];
  const fiveYearsLater = new Date();
  fiveYearsLater.setFullYear(fiveYearsLater.getFullYear() + 5);
  const expiryDefault = fiveYearsLater.toISOString().split('T')[0];

  const user = getCurrentUser();

  const [formData, setFormData] = useState({
    doc_id: generateUuid(),
    type: 'Land certificate',
    holder_name: '',
    holder_id: '',
    issue_date: today,
    expiry_date: expiryDefault,
    issuer_code: user?.issuerCode || 'ET-AA-LAND-04'
  });

  useEffect(() => {
    if (!user) {
      navigate('login', { redirect: 'issue', session_expired: true });
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Restore any unsaved form
    try {
      const unsaved = sessionStorage.getItem('wasenet_unsaved_form_issue');
      if (unsaved) {
        setFormData((prev) => ({ ...prev, ...JSON.parse(unsaved) }));
        sessionStorage.removeItem('wasenet_unsaved_form_issue');
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleChange = (field, val) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      try {
        sessionStorage.setItem('wasenet_unsaved_form_issue', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleRegenerateUuid = () => {
    handleChange('doc_id', generateUuid());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const errors = {};

    const { doc_id, type, holder_name, holder_id, issue_date, expiry_date, issuer_code } = formData;

    if (!doc_id) errors.doc_id = 'Document ID is required.';
    if (!holder_name.trim()) errors.holder_name = t('issue.val_name');
    if (!holder_id.trim()) errors.holder_id = t('issue.val_id');
    if (!issuer_code.trim()) errors.issuer_code = t('issue.val_issuer');
    if (!issue_date) errors.issue_date = 'Issue date is required.';
    if (!expiry_date) errors.expiry_date = 'Expiry date is required.';
    else if (new Date(expiry_date) <= new Date(issue_date)) {
      errors.expiry_date = t('issue.val_expiry');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSigning(true);

    const payload = {
      doc_id,
      type,
      holder_name,
      holder_id,
      issued_at: new Date(issue_date + 'T09:00:00Z').toISOString(),
      expires_at: new Date(expiry_date + 'T17:00:00Z').toISOString(),
      issuer_code
    };

    try {
      const signingProvider = getSigningProvider();
      const authToken = getToken();
      let signedResult;
      let isSyncedOnline = false;

      if (navigator.onLine) {
        try {
          signedResult = await signingProvider.signDocument(payload, 'wase-aa-2026-01', authToken);
          isSyncedOnline = true;
        } catch (serverErr) {
          // Fallback to isolated mock hardware provider if server temporarily unreachable
          const fallback = new IsolatedMockHardwareSigningProvider();
          signedResult = await fallback.signDocument(payload, 'wase-aa-2026-01');
          isSyncedOnline = false;
        }
      } else {
        // Offline issuance
        const offlineProvider = new IsolatedMockHardwareSigningProvider();
        signedResult = await offlineProvider.signDocument(payload, 'wase-aa-2026-01');
        isSyncedOnline = false;
      }

      // If offline or not synced to server, save in queue (FR-2.5)
      if (!isSyncedOnline) {
        await queueStore.addPending({
          doc_id,
          type,
          holder_name,
          payload,
          jws: signedResult.jws,
          createdAt: new Date().toISOString()
        });
      }

      // Cleanup unsaved storage
      sessionStorage.removeItem('wasenet_unsaved_form_issue');

      navigate('issue-done', {
        docId: doc_id,
        type,
        holderName: holder_name,
        jws: signedResult.jws,
        synced: isSyncedOnline
      });
    } catch (err) {
      setFormError('Signing failed: ' + err.message);
      setSigning(false);
    }
  };

  return (
    <div className="container-narrow">
      <h1>{t('issue.heading')}</h1>
      <p className="muted-text">{t('issue.subheading')}</p>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner" style={{ marginBottom: 'var(--space-4)' }} role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
          </svg>
          <span>{t('issue.offline_notice')}</span>
        </div>
      )}

      <div className="panel">
        <form onSubmit={handleSubmit} noValidate>
          {/* 1. Document ID */}
          <div className="form-group">
            <label htmlFor="issue-doc-id" className="form-label">
              {t('issue.doc_id_label')}
            </label>
            <div className="input-with-button">
              <input
                type="text"
                id="issue-doc-id"
                value={formData.doc_id}
                readOnly
                className="form-input"
                required
              />
              <button
                type="button"
                onClick={handleRegenerateUuid}
                className="btn btn-secondary"
                style={{ minHeight: '44px' }}
              >
                {t('issue.btn_regenerate')}
              </button>
            </div>
            <span className="form-hint">UUIDv4 generated automatically for unique global identification.</span>
            {fieldErrors.doc_id && <span className="form-error" role="alert">{fieldErrors.doc_id}</span>}
          </div>

          {/* 2. Document Type */}
          <div className="form-group">
            <label htmlFor="issue-doc-type" className="form-label">
              {t('issue.type_label')}
            </label>
            <select
              id="issue-doc-type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="form-select"
              required
            >
              <option value="Land certificate">{t('issue.type_land')}</option>
              <option value="Cooperative credential">{t('issue.type_coop')}</option>
              <option value="Birth record">{t('issue.type_birth')}</option>
              <option value="Local permit">{t('issue.type_permit')}</option>
            </select>
          </div>

          {/* 3. Holder Full Name */}
          <div className="form-group">
            <label htmlFor="issue-holder-name" className="form-label">
              {t('issue.holder_name_label')}
            </label>
            <input
              type="text"
              id="issue-holder-name"
              value={formData.holder_name}
              onChange={(e) => handleChange('holder_name', e.target.value)}
              className="form-input"
              placeholder="e.g. Abebe Bikila Wolde"
              autoComplete="name"
              required
            />
            <span className="form-hint">{t('issue.val_name')}</span>
            {fieldErrors.holder_name && <span className="form-error" role="alert">{fieldErrors.holder_name}</span>}
          </div>

          {/* 4. Holder National or Kebele ID */}
          <div className="form-group">
            <label htmlFor="issue-holder-id" className="form-label">
              {t('issue.holder_id_label')}
            </label>
            <input
              type="text"
              id="issue-holder-id"
              value={formData.holder_id}
              onChange={(e) => handleChange('holder_id', e.target.value)}
              className="form-input"
              placeholder="e.g. 99887766"
              inputMode="numeric"
              required
            />
            <span className="form-hint">{t('issue.val_id')}</span>
            {fieldErrors.holder_id && <span className="form-error" role="alert">{fieldErrors.holder_id}</span>}
          </div>

          {/* 5. Issue Date and Expiry Date (side by side on tablet/desktop) */}
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="issue-date" className="form-label">
                {t('issue.issue_date_label')}
              </label>
              <input
                type="date"
                id="issue-date"
                value={formData.issue_date}
                onChange={(e) => handleChange('issue_date', e.target.value)}
                className="form-input"
                required
              />
              {fieldErrors.issue_date && <span className="form-error" role="alert">{fieldErrors.issue_date}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="expiry-date" className="form-label">
                {t('issue.expiry_date_label')}
              </label>
              <input
                type="date"
                id="expiry-date"
                value={formData.expiry_date}
                onChange={(e) => handleChange('expiry_date', e.target.value)}
                className="form-input"
                required
              />
              <span className="form-hint">{t('issue.val_expiry')}</span>
              {fieldErrors.expiry_date && <span className="form-error" role="alert">{fieldErrors.expiry_date}</span>}
            </div>
          </div>

          {/* 6. Issuer Code */}
          <div className="form-group">
            <label htmlFor="issue-code" className="form-label">
              {t('issue.issuer_code_label')}
            </label>
            <input
              type="text"
              id="issue-code"
              value={formData.issuer_code}
              onChange={(e) => handleChange('issuer_code', e.target.value)}
              className="form-input"
              required
            />
            <span className="form-hint">{t('issue.val_issuer')}</span>
            {fieldErrors.issuer_code && <span className="form-error" role="alert">{fieldErrors.issuer_code}</span>}
          </div>

          {/* General Form Error Alert */}
          {formError && (
            <div className="form-error" style={{ marginBottom: 'var(--space-4)' }} role="alert">
              {formError}
            </div>
          )}

          {/* Sticky Submit Button on Mobile */}
          <div className="form-actions-sticky">
            <button
              type="submit"
              disabled={signing}
              className="btn btn-primary btn-full"
              style={{ minHeight: '50px', fontSize: '1.05rem' }}
            >
              {signing ? 'Signing and canonicalizing…' : t('issue.btn_sign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
