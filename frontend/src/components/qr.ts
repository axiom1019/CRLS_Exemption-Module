/*
 * QR codes are drawn in the browser (no outside service sees the codes). Level M error correction
 * survives a small stain or fold. Downloads are PNGs sized for printing at about 2.5 cm.
 */
import qrcode from 'qrcode-generator';
import { formatCode } from '@shared/codes';
import seal from '../assets/seal.png';

export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** An SVG path for the dark modules, with a 4-module quiet zone. */
export function qrSvg(text: string): { size: number; path: string } {
  const m = qrMatrix(text);
  const q = 4;
  let path = '';
  m.forEach((row, r) => row.forEach((dark, c) => dark && (path += `M${c + q} ${r + q}h1v1h-1z`)));
  return { size: m.length + 2 * q, path };
}

function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const m = qrMatrix(text);
  const q = 4;
  const cell = size / (m.length + 2 * q);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000';
  m.forEach((row, r) => row.forEach((dark, c) => dark && ctx.fillRect(Math.floor(x + (c + q) * cell), Math.floor(y + (r + q) * cell), Math.ceil(cell), Math.ceil(cell))));
}

/** QR alone, 600 × 600 px. */
export function qrPng(text: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 600;
  drawQr(canvas.getContext('2d')!, text, 0, 0, 600);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * A label to paste on the transmittal: the QR, "Scan to verify", the code and where to type it.
 * 1200 × 520 px, so about 6 × 2.6 cm at 500 dpi.
 */
export async function qrLabelPng(text: string, code: string, typeAt: string, caption: string): Promise<string> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 520;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  drawQr(ctx, text, 20, 20, 480);
  try {
    const img = await loadImage(seal);
    ctx.drawImage(img, 530, 40, 90, 90);
  } catch {
    /* label works without the seal */
  }
  const font = (w: number, s: number) => `${w} ${s}px 'Public Sans', Arial, sans-serif`;
  ctx.fillStyle = '#172554';
  ctx.font = font(700, 30);
  ctx.fillText('DHSUD REGION 10', 640, 80);
  ctx.fillStyle = '#475569';
  ctx.font = font(400, 26);
  ctx.fillText(caption, 640, 118);
  ctx.fillStyle = '#b91c1c';
  ctx.font = font(700, 46);
  ctx.fillText('Scan to verify', 530, 210);
  ctx.fillStyle = '#0f172a';
  ctx.font = font(400, 26);
  ctx.fillText('Verification code', 530, 280);
  ctx.font = font(700, 44);
  ctx.fillText(formatCode(code), 530, 332);
  ctx.fillStyle = '#475569';
  ctx.font = font(400, 26);
  ctx.fillText('Or type the code at', 530, 410);
  ctx.fillStyle = '#0f172a';
  ctx.font = font(700, 28);
  ctx.fillText(typeAt, 530, 448);
  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
