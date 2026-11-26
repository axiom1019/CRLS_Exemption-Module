/*
 * The printed transmittal: DHSUD letterhead, the letter, the signatory block, and a verification
 * box with the QR code, so the QR is part of the document rather than pasted on later.
 * A4 portrait; printed through the browser, which can also save it as PDF.
 */
import type { CertificateDto, SettingsDto } from '@shared/api';
import { formatCode } from '@shared/codes';
import { CERT_TYPE_LABELS } from '@shared/constants';
import { formatLongDate } from '@shared/dates';
import seal from '../assets/seal.png?inline';
import { qrSvg } from './qr';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const paras = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

export function defaultBody(c: CertificateDto, s: SettingsDto): string {
  const label = CERT_TYPE_LABELS[c.certType];
  const cover = c.coverage ? `, covering ${c.coverage}` : '';
  const host = s.verifyBaseUrl.replace(/^https:\/\//, '').replace(/\/$/, '');
  return [
    `We are transmitting herewith the ${label} No. ${c.certNumber} issued on ${formatLongDate(c.dateIssued)} in favor of ${c.developerName} for the project ${c.projectName}, located at ${c.projectLocation}${cover}.`,
    `The authenticity of this transmittal and of the enclosed certificate may be verified by scanning the QR code below, or by entering verification code ${formatCode(c.code)} at ${host}.`,
    'For your information and appropriate action.',
  ].join('\n\n');
}

export function transmittalHtml(c: CertificateDto, s: SettingsDto, body: string): string {
  const label = CERT_TYPE_LABELS[c.certType];
  const date = formatLongDate(c.transmittalDate || c.dateIssued);
  const qr = qrSvg(c.verifyUrl);
  const host = s.verifyBaseUrl.replace(/^https:\/\//, '').replace(/\/$/, '');
  const recipient = [c.recipientName, ...c.recipientAddress.split('\n')].map((x) => x.trim()).filter(Boolean);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Transmittal ${esc(c.transmittalNumber || c.certNumber)}</title>
<style>
@page { size: A4; margin: 16mm 18mm 14mm; }
* { box-sizing: border-box; }
@media screen { body { padding: 10mm 12mm; } }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11.5pt; line-height: 1.45; color: #000; }
.head { display: flex; align-items: center; gap: 12px; border-bottom: 2.5pt solid #1e3a8a; padding-bottom: 8px; }
.head img { width: 22mm; height: 22mm; }
.head .t { line-height: 1.25; }
.head .r { font-size: 9.5pt; }
.head .d { font-size: 13pt; font-weight: bold; color: #1e3a8a; }
.head .o { font-size: 10.5pt; font-weight: bold; }
.head .a { font-size: 9.5pt; color: #333; }
.redline { height: 2pt; background: #b91c1c; margin-top: 2px; }
.meta { display: flex; justify-content: space-between; margin-top: 18px; }
.to { margin-top: 18px; }
.to b { text-transform: uppercase; }
.subj { margin-top: 16px; display: grid; grid-template-columns: 22mm 1fr; }
.subj b { text-transform: uppercase; }
.salut { margin-top: 16px; }
.body p { margin: 0 0 10px; text-align: justify; text-indent: 12mm; }
.sign { margin-top: 22px; margin-left: 55%; }
.sign .n { margin-top: 34px; font-weight: bold; text-transform: uppercase; }
.encl { margin-top: 22px; font-size: 10pt; }
.verify { margin-top: 18px; border: 1.2pt solid #1e3a8a; border-radius: 3mm; padding: 3mm; display: flex; gap: 5mm; align-items: center; page-break-inside: avoid; }
.verify svg { width: 30mm; height: 30mm; flex: none; }
.verify .k { font-weight: bold; color: #b91c1c; font-size: 12pt; }
.verify .c { font-family: 'Courier New', monospace; font-weight: bold; font-size: 13pt; letter-spacing: 0.5pt; }
.verify .s { font-size: 9pt; color: #333; }
.prep { margin-top: 8px; font-size: 8.5pt; color: #444; }
</style></head><body>
<div class="head">
  <img src="${seal}" alt="">
  <div class="t">
    <div class="r">Republic of the Philippines</div>
    <div class="d">DEPARTMENT OF HUMAN SETTLEMENTS AND URBAN DEVELOPMENT</div>
    <div class="o">Regional Office X (Northern Mindanao)</div>
    <div class="a">${esc(s.officeAddress)}</div>
  </div>
</div>
<div class="redline"></div>
<div class="meta"><div>${c.transmittalNumber ? `Transmittal No. <b>${esc(c.transmittalNumber)}</b>` : ''}</div><div>${esc(date)}</div></div>
<div class="to">${recipient.length ? recipient.map((l, i) => (i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>') : '<b>&nbsp;</b>'}</div>
<div class="subj"><span>Subject:</span><b>Transmittal of ${esc(label)} No. ${esc(c.certNumber)}</b></div>
<div class="salut">Sir/Madam:</div>
<div class="body">${paras(body)}</div>
<div class="sign">Very truly yours,<div class="n">${esc(s.signatoryName) || '&nbsp;'}</div><div>${esc(s.signatoryTitle)}</div></div>
<div class="encl">Enclosure: ${esc(label)} No. ${esc(c.certNumber)}</div>
<div class="verify">
  <svg viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><rect width="${qr.size}" height="${qr.size}" fill="#fff"/><path d="${qr.path}" fill="#000"/></svg>
  <div>
    <div class="k">Scan to verify this document</div>
    <div class="s">Verification code</div>
    <div class="c">${formatCode(c.code)}</div>
    <div class="s">Or type the code at <b>${esc(host)}</b>. The page shows this transmittal and the certificate as issued by DHSUD Region 10.</div>
  </div>
</div>
${s.divisionName ? `<div class="prep">Prepared by: ${esc(s.divisionName)}</div>` : ''}
</body></html>`;
}
