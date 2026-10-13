import React from 'react';
import { useI18n } from '../i18n.jsx';

export default function Footer({ navigate }) {
  const { t } = useI18n();

  return (
    <footer role="contentinfo">
      <div className="wrap">
        <div>
          <p className="serif" style={{ fontSize: '1.25rem', color: 'var(--ink)' }}>
            {t('brand.name')}
          </p>
          <p style={{ marginTop: '6px', maxWidth: '34ch' }}>
            {t('footer.description')}
          </p>
        </div>

        <nav aria-label="Footer">
          <button
            onClick={() => navigate('verify')}
            className="link"
          >
            {t('footer.link_verify')}
          </button>
          <button
            onClick={() => navigate('login')}
            className="link"
          >
            {t('footer.link_offices')}
          </button>
          <a className="link" href="#for">
            {t('footer.link_privacy') || 'Privacy'}
          </a>
          <button
            onClick={() => navigate('test')}
            className="link"
          >
            Unit Tests
          </button>
        </nav>

        <p className="copy">{t('footer.copyright')}</p>
      </div>
    </footer>
  );
}
