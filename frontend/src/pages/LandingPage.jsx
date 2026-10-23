import React from 'react';
import { useI18n } from '../i18n.jsx';

export default function LandingPage({ navigate }) {
  const { t } = useI18n();

  return (
    <div>
      <section className="hero">
        <span className="badge">
          <b>{t('badge_new')}</b>
          {t('badge_text')}
        </span>
        <h1>{t('hero_title')}</h1>
        <p className="lead">{t('hero_sub')}</p>
        <div className="row-btns">
          <a
            className="btn"
            href="#/verify"
            onClick={(e) => {
              e.preventDefault();
              navigate('verify');
            }}
          >
            {t('cta_scan')}
          </a>
          <a
            className="btn outline"
            href="#/issue"
            onClick={(e) => {
              e.preventDefault();
              navigate('issue');
            }}
          >
            {t('cta_offices')}
          </a>
        </div>
      </section>

      <section className="showcase" aria-label="Example result">
        <div className="stage">
          <article className="cert">
            <div>
              <h3>{t('dt_land')}</h3>
              <dl className="rows">
                <div>
                  <dt>{t('f_holder')}</dt>
                  <dd>Abebe Bikila</dd>
                </div>
                <div>
                  <dt>{t('f_issuer')}</dt>
                  <dd>KEBELE-04-AA</dd>
                </div>
                <div>
                  <dt>{t('f_expires')}</dt>
                  <dd>1 Oct 2028</dd>
                </div>
              </dl>
            </div>
            <div className="qr" role="img" aria-label="QR code">
              QR
            </div>
            <p className="cert-status">
              {t('r_valid_t')} <span>{t('r_valid_x')}</span>
            </p>
          </article>
        </div>
      </section>

      <section className="section stats" aria-label="Key figures">
        {[1, 2, 3].map((i) => (
          <div className="card stat" key={i}>
            <strong>{t(`stat${i}_n`)}</strong>
            <span>{t(`stat${i}_l`)}</span>
          </div>
        ))}
      </section>

      <section className="section feat" aria-label="Features">
        {[1, 2, 3].map((i) => (
          <article className="card" key={i}>
            <h3>{t(`f${i}_t`)}</h3>
            <p>{t(`f${i}_d`)}</p>
          </article>
        ))}
      </section>

      <section className="section card close">
        <h2>{t('close_title')}</h2>
        <a
          className="btn"
          href="#/verify"
          onClick={(e) => {
            e.preventDefault();
            navigate('verify');
          }}
        >
          {t('close_btn')}
        </a>
      </section>
    </div>
  );
}
