import React from 'react';
import { useI18n } from '../i18n.jsx';

export default function LandingPage({ navigate }) {
  const { t } = useI18n();

  return (
    <div>
      {/* Hero Section */}
      <section className="hero wrap" id="verify">
        <a className="pill" href="#stats">
          <b>{t('landing.hero.pill_tag')}</b> {t('landing.hero.pill_text')}
        </a>
        <h1 className="serif">{t('landing.hero.headline')}</h1>
        <p className="sub">{t('landing.hero.supporting')}</p>
        <div className="ctas">
          <button onClick={() => navigate('verify')} className="btn">
            {t('landing.hero.scan_btn')}
          </button>
          <a href="#for" className="btn light">
            {t('landing.hero.offices_btn')}
          </a>
        </div>

        {/* Product Preview */}
        <div className="frame" aria-label="Example verification result">
          <div className="stage">
            <article className="cert">
              <div>
                <h3 className="serif">{t('landing.preview.doc_title')}</h3>
                <dl>
                  <div>
                    <dt>{t('landing.preview.holder_label')}</dt>
                    <dd>{t('landing.preview.holder_name')}</dd>
                  </div>
                  <div>
                    <dt>{t('landing.preview.issuer_label')}</dt>
                    <dd>{t('landing.preview.issuer_code')}</dd>
                  </div>
                  <div>
                    <dt>{t('landing.preview.issued_label')}</dt>
                    <dd>{t('landing.preview.issued_val') || '1 Oct 2026'}</dd>
                  </div>
                  <div>
                    <dt>{t('landing.preview.expires_label')}</dt>
                    <dd>{t('landing.preview.expires_val') || '1 Oct 2028'}</dd>
                  </div>
                </dl>
              </div>
              <div className="qr" role="img" aria-label="QR code">
                {t('landing.preview.qr_code')}
              </div>
              <p className="status">
                {t('landing.preview.valid_title')}{' '}
                <span>{t('landing.preview.valid_sub')}</span>
              </p>
            </article>
          </div>
          <div className="bar">
            <span>{t('landing.preview.caption_doc')}</span>
            <span>{t('landing.preview.caption_time')}</span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="wrap stats" id="stats" aria-label="Key figures">
        <div>
          <strong>{t('landing.figures.f1_num')}</strong>
          <span>{t('landing.figures.f1_label')}</span>
        </div>
        <div>
          <strong>{t('landing.figures.f2_num')}</strong>
          <span>{t('landing.figures.f2_label')}</span>
        </div>
        <div>
          <strong>{t('landing.figures.f3_num')}</strong>
          <span>{t('landing.figures.f3_label')}</span>
        </div>
      </section>

      {/* Features Section */}
      <section className="wrap features" id="for">
        <h2 className="serif">{t('landing.features.heading')}</h2>
        <p>{t('landing.features.intro')}</p>
        <div className="cols">
          <article className="col">
            <h3>{t('landing.features.c1_title')}</h3>
            <p>{t('landing.features.c1_body')}</p>
          </article>
          <article className="col">
            <h3>{t('landing.features.c2_title')}</h3>
            <p>{t('landing.features.c2_body')}</p>
          </article>
          <article className="col">
            <h3>{t('landing.features.c3_title')}</h3>
            <p>{t('landing.features.c3_body')}</p>
          </article>
        </div>

        <div className="close">
          <h2 className="serif">{t('landing.closing.heading')}</h2>
          <p>{t('landing.closing.supporting')}</p>
          <button onClick={() => navigate('verify')} className="btn">
            {t('landing.closing.btn')}
          </button>
        </div>
      </section>
    </div>
  );
}
