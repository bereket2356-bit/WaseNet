import React from 'react';
import { useI18n } from '../i18n.jsx';

export default function HowPage({ navigate }) {
  const { t } = useI18n();

  return (
    <div className="how-page">
      <section className="hero" style={{ paddingTop: '8px' }}>
        <h1>{t('how_title')}</h1>
        <p className="lead">{t('how_sub')}</p>
      </section>

      <section className="section stack">
        {[1, 2, 3, 4].map((i) => (
          <article className="card step" key={i}>
            <span className="num" aria-hidden="true">{i}</span>
            <div>
              <h3>{t(`hw${i}_t`)}</h3>
              <p className="muted">{t(`hw${i}_d`)}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="section cols2">
        <article className="card">
          <h3>{t('how_offline_t')}</h3>
          <p className="muted">{t('how_offline_d')}</p>
        </article>
        <article className="card">
          <h3>{t('how_privacy_t')}</h3>
          <p className="muted">{t('how_privacy_d')}</p>
        </article>
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
