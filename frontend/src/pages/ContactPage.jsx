import React from 'react';

export default function ContactPage({ navigate }) {
  return (
    <div className="verify-wrap" style={{ maxWidth: '640px' }}>
      <h1>Contact us</h1>
      <p className="muted" style={{ marginTop: '10px' }}>
        Questions about a document, a result, or using WaseNet? Reach the team below.
      </p>

      <div className="stack" style={{ marginTop: '28px', gap: '16px' }}>
        {/* Real INSA Details (NOT a placeholder) */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Fraud and identity reports</h2>
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>
            Information Network Security Administration (INSA)
          </p>
          <p className="muted" style={{ fontSize: '15px', margin: '0 0 12px', lineHeight: 1.5 }}>
            For digital or cyber-related document and identity authentication issues, reach INSA through the service above or by email.
          </p>
          <div className="row-btns">
            <a
              className="btn outline sm"
              href="https://www.insa.gov.et/service/Fraud-Prevention-Service"
              target="_blank"
              rel="noopener noreferrer"
            >
              INSA Fraud Prevention Service
            </a>
            <a
              className="btn outline sm"
              href="mailto:contact@insa.gov.et"
            >
              contact@insa.gov.et
            </a>
          </div>
        </div>

        {/* PLACEHOLDER: WaseNet support phone */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>WaseNet support phone</h2>
          <p style={{ margin: 0 }}>
            <a href="tel:+251000000000" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              +251 000 000 000
            </a>
          </p>
        </div>

        {/* PLACEHOLDER: WaseNet support email */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>WaseNet support email</h2>
          <p style={{ margin: 0 }}>
            <a href="mailto:support@example.org" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              support@example.org
            </a>
          </p>
        </div>

        {/* PLACEHOLDER: Office hours */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Office hours</h2>
          <p className="muted" style={{ margin: 0 }}>
            Monday to Friday, 8:30 to 17:00
          </p>
        </div>
      </div>

      <div style={{ marginTop: '36px', textAlign: 'center' }}>
        <p className="muted" style={{ marginBottom: '14px' }}>
          Tell us what you saw. A report helps us stop forged documents from being accepted.
        </p>
        <a
          className="btn outline danger"
          href="#/report"
          onClick={(e) => {
            e.preventDefault();
            navigate('report');
          }}
        >
          Report a fraud
        </a>
      </div>
    </div>
  );
}
