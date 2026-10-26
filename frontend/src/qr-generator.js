/**
 * WaseNet Offline QR Code Generator (Level M Error Correction)
 * Standards-compliant QR Code generator adhering strictly to SRS FR-2.4:
 * - Level M error correction
 * - Quiet zone: minimum 4 modules on all sides
 * - Minimum render size: 240px
 * - Compact JWS payload support
 */
import QRCode from 'qrcode';

export class QrCodeGenerator {
  /**
   * Generates a QR code and draws it to a target HTML canvas element
   * @param {HTMLCanvasElement} canvas 
   * @param {string} text - Payload to encode (e.g. JWS token)
   * @param {number} size - Desired pixel width/height (min 240px)
   */
  static drawToCanvas(canvas, text, size = 260) {
    if (!canvas || !text) return;
    const finalSize = Math.max(240, size);

    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const margin = 4; // SRS Requirement: At least 4 modules quiet zone
      const totalModules = moduleCount + margin * 2;

      canvas.width = finalSize;
      canvas.height = finalSize;
      const ctx = canvas.getContext('2d');

      // Clear with pure white background for high contrast
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, finalSize, finalSize);

      const cellSize = finalSize / totalModules;
      ctx.fillStyle = '#1E2B30';

      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            ctx.fillRect(
              Math.round((margin + c) * cellSize),
              Math.round((margin + r) * cellSize),
              Math.ceil(cellSize),
              Math.ceil(cellSize)
            );
          }
        }
      }
    } catch (err) {
      console.error('QR code generation failed:', err);
      if (err.message && err.message.toLowerCase().includes('too large')) {
        throw new Error('Payload too large for QR version. Keep the signed JWS payload compact.');
      }
      throw err;
    }
  }

  /**
   * Generates SVG string of QR code with Level M and 4-module quiet zone
   */
  static toSvgString(text, size = 260) {
    if (!text) return '';
    const finalSize = Math.max(240, size);
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const margin = 4;
      const totalModules = moduleCount + margin * 2;
      const cellSize = finalSize / totalModules;

      let paths = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            const x = ((margin + c) * cellSize).toFixed(2);
            const y = ((margin + r) * cellSize).toFixed(2);
            const s = cellSize.toFixed(2);
            paths += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#1E2B30"/>`;
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalSize} ${finalSize}" width="${finalSize}" height="${finalSize}"><rect width="${finalSize}" height="${finalSize}" fill="#FFFFFF"/>${paths}</svg>`;
    } catch (err) {
      console.error('QR SVG generation failed:', err);
      throw new Error('Payload too large for QR version. Keep the signed JWS payload compact.');
    }
  }

  /**
   * Generates deterministic boolean 2D matrix for text input
   */
  static generateMatrix(text) {
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const matrix = [];
      for (let r = 0; r < moduleCount; r++) {
        const row = [];
        for (let c = 0; c < moduleCount; c++) {
          row.push(Boolean(qr.modules.get(r, c)));
        }
        matrix.push(row);
      }
      return matrix;
    } catch (err) {
      console.error('Matrix generation failed:', err);
      throw new Error('Payload too large for QR version. Keep the signed JWS payload compact.');
    }
  }
}
