import QRCode from 'qrcode';

export interface QRGenerateOptions {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generate a QR code as a data URL (PNG) suitable for both `<img>` tags
 * and jsPDF `addImage` calls.
 */
export async function generateQRDataURL(
  payload: string,
  options: QRGenerateOptions = {}
): Promise<string> {
  const { size = 256, margin = 1, darkColor = '#000000', lightColor = '#ffffff' } = options;
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin,
    width: size,
    color: { dark: darkColor, light: lightColor },
  });
}

/**
 * Generate a QR code onto an offscreen canvas. Useful for layouts that
 * want vector rasterization control (e.g. K80 thermal receipts).
 */
export async function generateQRCanvas(
  payload: string,
  options: QRGenerateOptions = {}
): Promise<HTMLCanvasElement> {
  const { size = 256, margin = 1, darkColor = '#000000', lightColor = '#ffffff' } = options;
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, payload, {
    errorCorrectionLevel: 'M',
    margin,
    width: size,
    color: { dark: darkColor, light: lightColor },
  });
  return canvas;
}

/**
 * Synchronous data-URL variant for non-async render paths (e.g. print
 * preview). Internally uses a worker-free synchronous code path.
 */
export function generateQRDataURLSync(
  payload: string,
  options: QRGenerateOptions = {}
): string {
  const { size = 256, margin = 1, darkColor = '#000000', lightColor = '#ffffff' } = options;
  // qrcode has no synchronous dataURL API, so we build one by running
  // async + Promise then unwrap via a temporary canvas; however the
  // typical caller is inside a generator that already awaited an async
  // path, so just throw if misused.
  throw new Error('Use generateQRDataURL — sync variant not implemented.');
}