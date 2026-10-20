import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';

export default function AdminIssuersPage({ navigate }) {
  const { t } = useI18n();
  const [issuers, setIssuers] = useState([
    {
      id: 'iss-1',
      name: 'Addis Ababa Land Administration Office 04',
      code: 'ET-AA-LAND-04',
      status: 'Active'
    },
    {
      id: 'iss-2',
      name: 'Oromia Regional Cooperative Promotion Agency',
      code: 'ET-OR-COOP-01',
      status: 'Active'
    },
    {
      id: 'iss-3',
      name: 'Federal Vital Events Registration Agency (VERA)',
      code: 'ET-FED-VERA-02',
      status: 'Active'
    },
    {
      id: 'iss-4',
      name: 'Amhara Regional Trade and Industry Bureau',
      code: 'ET-AM-TRADE-03',
      status: 'Disabled'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== 'administrator') {
      navigate('issue');
    }
  }, []);

  const handleToggleStatus = (id) => {
    setIssuers((prev) =>
      prev.map((iss) =>
        iss.id === id
          ? { ...iss, status: iss.status === 'Active' ? 'Disabled' : 'Active' }
          : iss
      )
    );
  };

  const handleAddIssuer = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    const newEntry = {
      id: 'iss-' + Date.now(),
      name: newName.trim(),
      code: newCode.trim().toUpperCase(),
      status: 'Active'
    };

    setIssuers((prev) => [...prev, newEntry]);
    setIsModalOpen(false);
    setNewName('');
    setNewCode('');
  };

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)'
        }}
      >
        <div>
          <h1>{t('issuers.heading')}</h1>
          <p className="muted-text">{t('issuers.subheading')}</p>
        </div>
        <div>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            {t('issuers.btn_add_issuer')}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table" aria-label="Accredited issuing offices">
          <thead>
            <tr>
              <th>{t('issuers.col_name')}</th>
              <th>{t('issuers.col_code')}</th>
              <th>{t('issuers.col_status')}</th>
              <th>{t('issuers.col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {issuers.map((iss) => (
              <tr key={iss.id}>
                <td data-label={t('issuers.col_name')}><strong>{iss.name}</strong></td>
                <td data-label={t('issuers.col_code')}><code>{iss.code}</code></td>
                <td data-label={t('issuers.col_status')}>
                  <span className={`tag-status ${iss.status === 'Active' ? 'valid' : 'expired'}`}>
                    {iss.status === 'Active' ? t('issuers.status_active') : t('issuers.status_disabled')}
                  </span>
                </td>
                <td data-label={t('issuers.col_actions')}>
                  <button
                    onClick={() => handleToggleStatus(iss.id)}
                    className="btn btn-secondary"
                    style={{ minHeight: '44px', padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    {iss.status === 'Active' ? t('issuers.btn_disable') : t('issuers.btn_enable')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Issuer Modal */}
      {isModalOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog-panel">
            <h2 style={{ marginBottom: 'var(--space-3)' }}>{t('issuers.btn_add_issuer')}</h2>
            <form onSubmit={handleAddIssuer}>
              <div className="form-group">
                <label htmlFor="new-issuer-name" className="form-label">Office full name</label>
                <input
                  type="text"
                  id="new-issuer-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Dire Dawa Urban Registry"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-issuer-code" className="form-label">Assigned issuer code</label>
                <input
                  type="text"
                  id="new-issuer-code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="form-input"
                  placeholder="e.g. ET-DD-REG-01"
                  required
                />
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save office
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
