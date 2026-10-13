import React, { useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { login } from '../auth.js';

export default function LoginPage({ routeParams, navigate }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSessionEnded = routeParams?.session_expired === true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    const res = await login(username.trim(), password);
    setLoading(false);

    if (res.success) {
      const redirect = routeParams?.redirect || (res.user.role === 'administrator' ? 'issue' : 'issue');
      navigate(redirect);
    } else {
      setError(true);
    }
  };

  return (
    <div className="container-narrow">
      <h1>{t('login.heading')}</h1>
      <p className="muted-text">{t('login.subheading')}</p>

      {/* Session Expired Notice */}
      {isSessionEnded && (
        <div
          className="tamper-notice"
          style={{ backgroundColor: '#FDF7EF', borderColor: 'rgba(138, 90, 18, 0.3)', marginBottom: 'var(--space-4)' }}
        >
          <p style={{ margin: 0, color: 'var(--status-expired)' }}>
            {t('login.session_ended')}
          </p>
        </div>
      )}

      <div className="panel">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              {t('login.username_label')}
            </label>
            <input
              type="text"
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              {t('login.password_label')}
            </label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoComplete="current-password"
              required
            />
          </div>

          {/* Neutral Error Text on Failure */}
          {error && (
            <div className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
              {t('login.error_failed')}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ minHeight: '48px' }}
          >
            {loading ? 'Signing in…' : t('login.btn_sign_in')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-rule)' }}>
          <p className="muted-text" style={{ fontSize: '0.84rem', marginBottom: 0 }}>
            {t('login.hint_roles')}
          </p>
        </div>
      </div>
    </div>
  );
}
