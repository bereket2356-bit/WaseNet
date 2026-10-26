// WaseNet specimen print sheet generator matching specimen template specification
const DOC_TYPES = {
  dt_land: 'Land certificate',
  dt_coop: 'Cooperative credential',
  dt_birth: 'Birth record',
  dt_permit: 'Local permit',
  'Land certificate': 'Land certificate',
  'Cooperative credential': 'Cooperative credential',
  'Birth record': 'Birth record',
  'Local permit': 'Local permit'
};

export function getDocTypeLabel(type) {
  return DOC_TYPES[type] || type || 'Document';
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatFan(val) {
  const digits = String(val || '').replace(/\D/g, '').slice(0, 16);
  const parts = digits.match(/.{1,4}/g);
  return {
    digits,
    formatted: parts ? parts.join('-') : digits
  };
}

export function formatDateDisplay(val) {
  if (!val) return '—';
  try {
    const raw = String(val).split('T')[0].trim();
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (months[monthIdx] && !isNaN(day) && !isNaN(year)) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
  } catch (e) {}
  return String(val);
}

export function fillPrintSheet(d) {
  let sheet = document.getElementById('print-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'print-sheet';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.display = 'none';
    document.body.appendChild(sheet);
  }
  if (!d) return;

  const docType = getDocTypeLabel(d.type || d.docType || d.doc_type);
  const docId = d.doc_id || d.docId || d.id || '';
  const holderName = d.holder_name || d.holder || d.holderName || '';
  const fanRaw = d.holder_id || d.holderId || d.fan || '';
  const holderFan = formatFan(fanRaw).formatted || fanRaw;
  const issuerCode = d.issuer_code || d.issuer || d.issuerCode || 'SPEC-00-AA';
  const issueDateRaw = d.issued_at || d.issued || d.issueDate || d.issue_date || '';
  const expiryDateRaw = d.expires_at || d.expires || d.expiryDate || d.expiry_date || '';
  const issueDateDisplay = formatDateDisplay(issueDateRaw);
  const expiryDateDisplay = formatDateDisplay(expiryDateRaw);

  const photo = d.photo || '';

  sheet.innerHTML = `
    <div class="specimen-card ps-sheet" role="region" aria-label="Document certificate sheet">
      <!-- Header Block: Title, Subtitle, and 4x4cm Image Holder -->
      <div class="sheet-header ps-head">
        <div class="sheet-title-block">
          <h2 class="sheet-title">${escapeHtml(docType)}</h2>
          <p class="sheet-subtitle ps-sub">WaseNet specimen layout · Fictional data</p>
        </div>
        ${photo ? `
          <div class="photo-holder-4cm ps-photo has-photo" role="img" aria-label="Holder photo">
            <img src="${escapeHtml(photo)}" alt="Holder photo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
          </div>
        ` : `
          <div class="photo-holder-4cm ps-photo" role="img" aria-label="Image holder, 4 by 4 centimetres">
            <div class="holder-title">Image</div>
            <div class="holder-dim">4 × 4 cm</div>
          </div>
        `}
      </div>

      <!-- Thick Horizontal Rule -->
      <div class="sheet-divider-thick" aria-hidden="true"></div>

      <!-- 3 Field Rows (2 columns per row) -->
      <div class="sheet-fields ps-grid">
        <!-- Row 1: Document ID and Holder Name -->
        <div class="field-row ps-field">
          <div class="field-col">
            <span class="field-label ps-label">Document ID</span>
            <span class="field-val ps-val">${escapeHtml(docId)}</span>
          </div>
          <div class="field-col">
            <span class="field-label ps-label">Holder name</span>
            <span class="field-val ps-val">${escapeHtml(holderName)}</span>
          </div>
        </div>

        <!-- Row 2: Holder FAN ID and Issuer Code -->
        <div class="field-row ps-field">
          <div class="field-col">
            <span class="field-label ps-label">Holder FAN ID</span>
            <span class="field-val fan-text ps-val">${escapeHtml(holderFan)}</span>
          </div>
          <div class="field-col">
            <span class="field-label ps-label">Issuer code</span>
            <span class="field-val ps-val">${escapeHtml(issuerCode)}</span>
          </div>
        </div>

        <!-- Row 3: Issue Date and Expiry Date -->
        <div class="field-row ps-field">
          <div class="field-col">
            <span class="field-label ps-label">Issue date</span>
            <span class="field-val ps-val">${escapeHtml(issueDateDisplay)}</span>
          </div>
          <div class="field-col">
            <span class="field-label ps-label">Expiry date</span>
            <span class="field-val ps-val">${escapeHtml(expiryDateDisplay)}</span>
          </div>
        </div>
      </div>

      <!-- QR Placeholder Section with text on the right -->
      <div class="qr-row">
        <div class="qr-placeholder-box ps-qr" role="img" aria-label="QR code placeholder">
          <div>QR code</div>
          <div>(generated on issue)</div>
        </div>
        <div class="qr-explanation">
          Scan with the WaseNet verifier. Specimen codes carry test data only and will show a verification result for demonstration.
        </div>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.fillPrintSheet = fillPrintSheet;
  window.escapeHtml = escapeHtml;
}
