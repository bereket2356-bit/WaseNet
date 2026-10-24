import React from 'react';

export default function LandingPage({ navigate }) {
  return (
    <div>
      <header className="page-intro hero">
        <span className="badge" style={{ marginBottom: '16px' }}>
          <b>New</b>
          Up to 30 days offline
        </span>
        <h1>Verify a document in one scan.</h1>
        <p className="lead">
          WaseNet proves land certificates, cooperative credentials, and local permits genuine, even when the network is down.
        </p>
        <div className="row-btns">
          <a
            className="btn"
            href="#/verify"
            onClick={(e) => {
              e.preventDefault();
              navigate('verify');
            }}
          >
            Scan a document
          </a>
          <a
            className="btn outline"
            href="#/issue"
            onClick={(e) => {
              e.preventDefault();
              navigate('issue');
            }}
          >
            For issuing offices
          </a>
        </div>
      </header>

      <section className="showcase" aria-label="Example result">
        <div className="stage">
          <article className="cert">
            <div>
              <h3>Land certificate</h3>
              <dl className="rows">
                <div>
                  <dt>Holder name</dt>
                  <dd>Abebe Bikila</dd>
                </div>
                <div>
                  <dt>Issuer code</dt>
                  <dd>KEBELE-04-AA</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>1 Oct 2028</dd>
                </div>
              </dl>
            </div>
            <div className="qr" role="img" aria-label="QR code">
              QR
            </div>
            <p className="cert-status">
              Valid <span>Authentic and current.</span>
            </p>
          </article>
        </div>
      </section>

      <section className="section stats" aria-label="Key figures">
        <div className="card stat">
          <strong>30 days</strong>
          <span>Works without a signal</span>
        </div>
        <div className="card stat">
          <strong>&lt; 2 sec</strong>
          <span>From scan to result</span>
        </div>
        <div className="card stat">
          <strong>4 outcomes</strong>
          <span>Valid, Tampered, Revoked, or Expired</span>
        </div>
      </section>

      <section className="section feat" aria-label="Features">
        <article className="card">
          <h3>For verifiers</h3>
          <p>Scan the code, read the result. No account needed.</p>
        </article>
        <article className="card">
          <h3>For issuing offices</h3>
          <p>Fill one form, sign, and print the QR code. Offline work waits in a queue.</p>
        </article>
        <article className="card">
          <h3>For administrators</h3>
          <p>Manage keys, cancel documents, and keep an audit trail.</p>
        </article>
      </section>

      <section className="section card close">
        <h2>Make a document checkable in seconds.</h2>
        <div className="row-btns" style={{ justifyContent: 'center' }}>
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
      </section>
    </div>
  );
}
