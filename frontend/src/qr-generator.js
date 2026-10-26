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

    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const margin = 4; // SRS Requirement: At least 4 modules quiet zone
      const totalModules = moduleCount + margin * 2;

      // Ensure exact integer cell size (minimum 3px) so modules do not overlap or distort finder patterns
      const targetSize = Math.max(240, size);
      const cellSize = Math.max(3, Math.ceil(targetSize / totalModules));
      const actualSize = totalModules * cellSize;

      canvas.width = actualSize;
      canvas.height = actualSize;
      const ctx = canvas.getContext('2d');

      // Clear with pure white background for maximum contrast
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, actualSize, actualSize);

      // Draw pure black modules on exact integer boundaries
      ctx.fillStyle = '#000000';

      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            ctx.fillRect(
              (margin + c) * cellSize,
              (margin + r) * cellSize,
              cellSize,
              cellSize
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
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const moduleCount = qr.modules.size;
      const margin = 4;
      const totalModules = moduleCount + margin * 2;
      const cellSize = Math.max(3, Math.ceil(size / totalModules));
      const actualSize = totalModules * cellSize;

      let paths = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            const x = (margin + c) * cellSize;
            const y = (margin + r) * cellSize;
            paths += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#000000"/>`;
          }
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${actualSize} ${actualSize}" width="${actualSize}" height="${actualSize}" shape-rendering="crispEdges"><rect width="${actualSize}" height="${actualSize}" fill="#FFFFFF"/>${paths}</svg>`;
    } catch (err) {
      console.error('QR SVG generation failed:', err);
      return '';
    }
  }

  /**
   * Generates a high-resolution lossless PNG data URL of the QR code
   */
  static async toDataUrl(text, size = 360) {
    if (!text) return '';
    try {
      return await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 4,
        width: size
      });
    } catch (err) {
      console.error('QR data URL generation failed:', err);
      return '';
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
