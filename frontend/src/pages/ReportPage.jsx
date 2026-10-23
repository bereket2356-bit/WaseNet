import React, { useState } from 'react';

const generateRefCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = 'FR-';
  for (let i = 0; i < 8; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

export default function ReportPage({ routeParams, navigate }) {
  const [docId, setDocId] = useState(routeParams?.docid || routeParams?.docId || '');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [contactDetails, setContactDetails] = useState('');

  const [errors, setErrors] = useState({});
  const [submittedRef, setSubmittedRef] = useState(null);

  const handleDescChange = (e) => {
    const val = e.target.value;
    if (val.length <= 500) {
      setDescription(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!docId.trim()) {
      newErrors.docId = 'Enter the document ID.';
    }
    if (!reason.trim()) {
      newErrors.reason = 'Choose what you saw.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    // In production, an authorized backend service would securely forward this report directly to INSA.
    // In this offline/prototype mode, submission is simulated in-memory and nothing is persisted beyond the session.
    const ref = generateRefCode();
    setSubmittedRef(ref);
    window.scrollTo(0, 0);
  };

  if (submittedRef) {
    const mailtoSubject = `Fraud report ${submittedRef}`;
    const mailtoBody = `Document ID: ${docId.trim()}
Issue observed: ${reason}
Description: ${description.trim() || 'None provided'}
Contact: ${contactDetails.trim() || 'None provided'}`;
    const mailtoUrl = `mailto:contact@insa.gov.et?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;

    return (
      <div className="verify-wrap" style={{ maxWidth: '620px' }}>
        <section className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <h2>Report received</h2>
          <p className="muted" style={{ marginTop: '14px', fontSize: '18px', wordBreak: 'break-word', fontWeight: 600 }}>
            Reference: {submittedRef}. Keep this for your records.
          </p>
          <p className="muted" style={{ marginTop: '10px', fontSize: '15px' }}>
            Your report is routed to INSA for review.
          </p>

          <div className="stack" style={{ marginTop: '28px', gap: '12px' }}>
            <div className="row-btns" style={{ justifyContent: 'center' }}>
              <a
                className="btn outline"
                href={mailtoUrl}
              >
                Send to INSA by email
              </a>
              <a
                className="btn outline"
                href="https://www.insa.gov.et/service/Fraud-Prevention-Service"
                target="_blank"
                rel="noopener noreferrer"
              >
                INSA Fraud Prevention Service
              </a>
            </div>

            <div className="row-btns" style={{ justifyContent: 'center', marginTop: '12px' }}>
              <a
                className="btn"
                href="#/verify"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('verify');
                }}
              >
                Back to scanning
              </a>
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
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="verify-wrap" style={{ maxWidth: '620px' }}>
      <header className="page-intro">
        <h1>Report a fraud</h1>
        <p className="intro">
          Tell us what you saw. A report helps us stop forged documents from being accepted.
        </p>
      </header>

      {/* Advisory Note */}
      <p className="muted" style={{ marginTop: '0px', fontSize: '14px', lineHeight: 1.6 }}>
        Fraud reports for digital or cyber-related document and identity authentication issues go to the Information Network Security Administration (INSA). You can also report directly through the{' '}
        <a
          href="https://www.insa.gov.et/service/Fraud-Prevention-Service"
          target="_blank"
          rel="noopener noreferrer"
        >
          INSA Fraud Prevention Service
        </a>{' '}
        or by email at{' '}
        <a href="mailto:contact@insa.gov.et">
          contact@insa.gov.et
        </a>.
      </p>

      <form id="f-report" className="card" style={{ marginTop: '24px' }} noValidate onSubmit={handleSubmit}>
        {/* 1. Document ID */}
        <label className="field">
          <span>Document ID</span>
          <input
            name="docId"
            value={docId}
            onChange={(e) => {
              setDocId(e.target.value);
              if (errors.docId) setErrors((prev) => ({ ...prev, docId: null }));
            }}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            autoComplete="off"
            required
          />
          {errors.docId && <span className="field-err" role="alert">{errors.docId}</span>}
        </label>

        {/* 2. What did you see? */}
        <label className="field">
          <span>What did you see?</span>
          <select
            name="reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (errors.reason) setErrors((prev) => ({ ...prev, reason: null }));
            }}
            required
          >
            <option value="">Choose one</option>
            <option value="Signature failed">Signature failed</option>
            <option value="Details do not match the holder">Details do not match the holder</option>
            <option value="Document was reported lost">Document was reported lost</option>
            <option value="Document looks forged">Document looks forged</option>
            <option value="Other">Other</option>
          </select>
          {errors.reason && <span className="field-err" role="alert">{errors.reason}</span>}
        </label>

        {/* 3. Describe what happened (optional, max 500 chars) */}
        <label className="field">
          <span>Describe what happened (optional)</span>
          <textarea
            name="description"
            value={description}
            onChange={handleDescChange}
            rows={4}
            maxLength={500}
            placeholder="Provide any relevant details..."
          />
          <div className="char-count">
            {description.length} / 500 characters
          </div>
        </label>

        {/* 4. Your contact details (optional) */}
        <label className="field">
          <span>Your contact details (optional)</span>
          <input
            name="contactDetails"
            value={contactDetails}
            onChange={(e) => setContactDetails(e.target.value)}
            placeholder="Phone number or email address"
            autoComplete="email tel"
          />
        </label>

        <p style={{ marginTop: '24px' }}>
          <button className="btn block" type="submit">
            Send report
          </button>
        </p>
      </form>
    </div>
  );
}
