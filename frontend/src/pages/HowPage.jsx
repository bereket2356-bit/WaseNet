import React from 'react';

const STEPS = [
  {
    num: 1,
    title: 'Issue the document',
    desc: "An authorized officer fills in the holder's details, signs the record, and prints a QR code on the document."
  },
  {
    num: 2,
    title: 'The QR code carries the proof',
    desc: 'The QR code holds the document data and a digital signature. Any change to the data breaks the signature.'
  },
  {
    num: 3,
    title: 'Scan it anywhere',
    desc: 'A verifier scans the code with a phone. The check runs on the device, so it works without a signal.'
  },
  {
    num: 4,
    title: 'Read one clear result',
    desc: 'The result is Valid, Tampered, Revoked, or Expired. A document that fails the signature check is never shown as valid.'
  }
];

export default function HowPage({ navigate }) {
  return (
    <div className="how-page">
      <header className="page-intro">
        <h1>How WaseNet works</h1>
        <p className="intro">
          Four steps from issuing a document to checking it, and what happens when there is no signal.
        </p>
      </header>

      <section className="section stack" style={{ marginTop: '0px' }}>
        {STEPS.map((s) => (
          <article className="card step" key={s.num}>
            <span className="num" aria-hidden="true">{s.num}</span>
            <div>
              <h3>{s.title}</h3>
              <p className="muted">{s.desc}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="section cols2">
        <article className="card">
          <h3>Works without a signal</h3>
          <p className="muted">
            Once the trusted keys and the revocation list are on the device, checks run offline for up to 30 days. Updates arrive whenever a connection is available.
          </p>
        </article>
        <article className="card">
          <h3>Only what's needed</h3>
          <p className="muted">
            The verifier app stores only the keys, the revocation list, and a log of checks. Personal details are limited to what the document requires.
          </p>
        </article>
      </section>

      <section className="section card close">
        <h2>Make a document checkable in seconds.</h2>
        <a
          className="btn"
          href="#/verify"
          onClick={(e) => {
            e.preventDefault();
            navigate('verify');
          }}
        >
          Start scanning
        </a>
      </section>
    </div>
  );
}
