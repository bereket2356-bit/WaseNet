import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { getCurrentUser } from '../auth.js';
import { keyStore } from '../storage.js';

export default function AdminKeysPage({ navigate }) {
  const { t } = useI18n();
  const [keys, setKeys] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKid, setNewKid] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState('Active');

  const loadKeys = async () => {
    const list = await keyStore.getAllKeys();
    setKeys(list);
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== 'administrator') {
      navigate('issue');
      return;
    }
    loadKeys();
  }, []);

  const handleToggleStatus = async (kid) => {
    const rec = await keyStore.getKey(kid);
    if (rec) {
      rec.status = rec.status === 'Active' ? 'Revoked' : 'Active';
      await keyStore.putKey(rec);
      await loadKeys();
    }
  };

  const handleAddKey = async (e) => {
    e.preventDefault();
    if (!newKid.trim()) return;

    await keyStore.putKey({
      kid: newKid.trim(),
      description: newDesc.trim(),
      status: newStatus,
      createdDate: new Date().toISOString().split('T')[0],
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'mock-x-' + Math.random().toString(36).substring(2, 10),
        y: 'mock-y-' + Math.random().toString(36).substring(2, 10)
      }
    });

    setIsModalOpen(false);
    setNewKid('');
    setNewDesc('');
    await loadKeys();
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
          <h1>{t('keys.heading')}</h1>
          <p className="muted-text">{t('keys.subheading')}</p>
        </div>
        <div>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            {t('keys.btn_add_key')}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table" aria-label="Cryptographic public key store">
          <thead>
            <tr>
              <th>{t('keys.col_kid')}</th>
              <th>{t('keys.col_created')}</th>
              <th>{t('keys.col_status')}</th>
              <th>{t('keys.col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const statusClass =
                k.status === 'Active' ? 'valid' : k.status === 'Revoked' ? 'revoked' : 'expired';
              return (
                <tr key={k.kid}>
                  <td>
                    <strong>{k.kid}</strong>
                    {k.description && (
                      <div className="muted-text" style={{ fontSize: '0.82rem' }}>
                        {k.description}
                      </div>
                    )}
                  </td>
                  <td>{k.createdDate || '—'}</td>
                  <td>
                    <span className={`tag-status ${statusClass}`}>
                      {k.status || 'Active'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleStatus(k.kid)}
                      className="btn btn-secondary"
                      style={{ padding: '2px 10px', fontSize: '0.82rem' }}
                    >
                      {t('keys.btn_change_status')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Public Key Modal */}
      {isModalOpen && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog-panel">
            <h2 style={{ marginBottom: 'var(--space-3)' }}>{t('keys.btn_add_key')}</h2>
            <form onSubmit={handleAddKey}>
              <div className="form-group">
                <label htmlFor="modal-kid" className="form-label">Key ID (kid)</label>
                <input
                  type="text"
                  id="modal-kid"
                  value={newKid}
                  onChange={(e) => setNewKid(e.target.value)}
                  className="form-input"
                  placeholder="e.g. wase-sidama-2026-01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-desc" className="form-label">Issuing authority name</label>
                <input
                  type="text"
                  id="modal-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Sidama Regional Land Bureau"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-status" className="form-label">Status</label>
                <select
                  id="modal-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="form-select"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Revoked">Revoked</option>
                </select>
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
                  Save key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
