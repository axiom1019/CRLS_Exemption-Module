import { useEffect, useMemo, useState } from 'react';
import type { CertificateDto } from '@shared/api';
import { formatCode } from '@shared/codes';
import { CERT_TYPE_LABELS, DOC_KINDS, DOC_LABELS, MAX_PDF_BYTES, type DocKind } from '@shared/constants';
import { formatLongDate, manilaDateTime } from '@shared/dates';
import type { CertificateForm } from '@shared/schemas';
import { api, errorText, fieldErrors, newKey } from '../api/client';
import { useSession } from '../session';
import { CertForm, emptyForm } from './CertForm';
import { TransmittalModal } from './TransmittalModal';
import { formatBytes, openBase64Pdf, readFileBase64 } from './files';
import { downloadDataUrl, qrLabelPng, qrPng, qrSvg } from './qr';
import { Field, Loading, Modal, StatusPill, useToast } from './ui';

const toForm = (c: CertificateDto): CertificateForm => ({
  certType: c.certType,
  certNumber: c.certNumber,
  dateIssued: c.dateIssued,
  transmittalNumber: c.transmittalNumber,
  transmittalDate: c.transmittalDate,
  recipientName: c.recipientName,
  recipientAddress: c.recipientAddress,
  projectName: c.projectName,
  projectLocation: c.projectLocation,
  developerName: c.developerName,
  coverage: c.coverage,
  remarks: c.remarks,
});

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Recorded',
  EDIT: 'Edited',
  CORRECT: 'Corrected after release',
  UPLOAD_SCAN: 'Uploaded a scan',
  REPLACE_SCAN: 'Replaced a scan',
  RELEASE: 'Released',
  REVOKE: 'Revoked',
};

export function RecordModal(props: { certId: string | null; onClose: () => void; onChanged: (certId?: string) => void }) {
  const toast = useToast();
  const { has } = useSession();
  const admin = has('ADMIN');
  const [cert, setCert] = useState<CertificateDto | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState<CertificateForm>(emptyForm);
  const [editing, setEditing] = useState(props.certId === null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [idemKey] = useState(newKey);

  useEffect(() => {
    if (!props.certId) return;
    api('api_getCertificate', { certId: props.certId }).then(
      (c) => (setCert(c), setForm(toForm(c))),
      (e: unknown) => setLoadErr(errorText(e)),
    );
  }, [props.certId]);

  const run = async (label: string, fn: () => Promise<CertificateDto | void>, done?: string) => {
    setBusy(label);
    setErr('');
    setErrors({});
    try {
      const c = await fn();
      if (c) {
        setCert(c);
        setForm(toForm(c));
      }
      if (done) toast(done);
      props.onChanged(c ? c.certId : undefined);
      return true;
    } catch (e) {
      setErr(errorText(e));
      setErrors(fieldErrors(e));
      return false;
    } finally {
      setBusy('');
    }
  };

  // ---- new record
  if (!props.certId && !cert) {
    return (
      <Modal
        title="New certificate record"
        subtitle="Type the details exactly as they appear on the certificate. You get the QR code right after saving."
        onClose={props.onClose}
        footer={
          <>
            <button className="btn" onClick={props.onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!!busy} onClick={() => void run('save', () => api('api_createCertificate', { idempotencyKey: idemKey, form }), 'Saved as a draft. Download the QR code next.').then((ok) => ok && setEditing(false))}>
              {busy ? 'Saving…' : 'Save and get the QR code'}
            </button>
          </>
        }
      >
        {err && <div className="form-err">{err}</div>}
        <CertForm value={form} onChange={setForm} errors={errors} />
      </Modal>
    );
  }

  if (!cert) {
    return (
      <Modal title="Certificate record" onClose={props.onClose} narrow>
        <Loading error={loadErr} />
      </Modal>
    );
  }

  const draft = cert.status === 'DRAFT';
  const canEdit = draft || admin;
  const needsReason = !draft;
  const docOf = (k: DocKind) => cert.documents.find((d) => d.kind === k);

  return (
    <Modal
      title={`${CERT_TYPE_LABELS[cert.certType]} No. ${cert.certNumber}`}
      subtitle={`${cert.projectName} · ${cert.developerName}`}
      onClose={props.onClose}
      footer={
        editing ? (
          <>
            <button className="btn" onClick={() => (setEditing(false), setForm(toForm(cert)), setErrors({}), setErr(''))}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!!busy || (needsReason && !reason.trim())}
              onClick={() =>
                void run('save', () => api('api_updateCertificate', { certId: cert.certId, version: cert.version, form, ...(needsReason ? { reason } : {}) }), 'Saved.').then(
                  (ok) => ok && (setEditing(false), setReason('')),
                )
              }
            >
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : (
          <button className="btn" onClick={props.onClose}>
            Close
          </button>
        )
      }
    >
      {err && <div className="form-err">{err}</div>}
      <StatusBanner cert={cert} />

      <div className="detail-grid">
        <div>
          {editing ? (
            <>
              {needsReason && (
                <div className="notice">
                  This record is already {cert.status === 'VALID' ? 'released' : 'revoked'}. The change shows on the public page at once and is kept in the log.
                  <Field label="Reason for the correction" error={errors.reason}>
                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>
                </div>
              )}
              <CertForm value={form} onChange={setForm} errors={errors} />
            </>
          ) : (
            <>
              <div className="section-title">Details</div>
              <dl className="kv">
                <dt>Type</dt>
                <dd>{CERT_TYPE_LABELS[cert.certType]}</dd>
                <dt>Certificate number</dt>
                <dd>{cert.certNumber}</dd>
                <dt>Date issued</dt>
                <dd>{formatLongDate(cert.dateIssued)}</dd>
                <dt>Transmittal</dt>
                <dd>{[cert.transmittalNumber, cert.transmittalDate && formatLongDate(cert.transmittalDate)].filter(Boolean).join(', ') || '—'}</dd>
                <dt>Addressed to</dt>
                <dd style={{ whiteSpace: 'pre-line' }}>{[cert.recipientName, cert.recipientAddress].filter(Boolean).join('\n') || '—'}</dd>
                <dt>Project</dt>
                <dd>{cert.projectName}</dd>
                <dt>Location</dt>
                <dd>{cert.projectLocation}</dd>
                <dt>Owner or developer</dt>
                <dd>{cert.developerName}</dd>
                <dt>Lots or area</dt>
                <dd>{cert.coverage || '—'}</dd>
                <dt>Internal remarks</dt>
                <dd className="muted">{cert.remarks || '—'}</dd>
              </dl>
              {canEdit && (
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={() => setEditing(true)}>
                    {draft ? 'Edit details' : 'Correct details'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <QrPanel cert={cert} />
          <div className="section-title" style={{ marginTop: 20 }}>
            Signed scans
          </div>
          {needsReason && admin && (
            <Field label="Reason, if you replace a scan" hint="Only the administrator can replace a scan after release.">
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <ul className="doc-list">
            {DOC_KINDS.map((k) => {
              const d = docOf(k);
              const canUpload = draft || (admin && reason.trim().length > 0);
              return (
                <li key={k}>
                  <div>
                    <b>{DOC_LABELS[k]}</b>
                    <div className="meta">{d ? `${d.fileName} · ${formatBytes(d.sizeBytes)} · ${manilaDateTime(Date.parse(d.uploadedAt))}` : 'Not uploaded yet'}</div>
                  </div>
                  <div className="actions">
                    {d && (
                      <button
                        className="btn small-btn"
                        disabled={!!busy}
                        onClick={() =>
                          void run(`view-${k}`, async () => {
                            const f = await api('api_downloadDocument', { certId: cert.certId, kind: k });
                            openBase64Pdf(f.base64, f.fileName);
                          })
                        }
                      >
                        View
                      </button>
                    )}
                    {(draft || admin) && (
                      <label className={`btn small-btn${canUpload && !busy ? '' : ' disabled'}`}>
                        {busy === `up-${k}` ? 'Uploading…' : d ? 'Replace' : 'Upload PDF'}
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          disabled={!canUpload || !!busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            if (file.size > MAX_PDF_BYTES) {
                              setErr(`The file is ${formatBytes(file.size)}. Scan at 200 to 300 dpi to keep it under ${formatBytes(MAX_PDF_BYTES)}.`);
                              return;
                            }
                            void run(
                              `up-${k}`,
                              async () =>
                                api('api_uploadDocument', {
                                  certId: cert.certId,
                                  kind: k,
                                  fileName: file.name,
                                  base64: await readFileBase64(file),
                                  ...(needsReason ? { reason } : {}),
                                }),
                              `${DOC_LABELS[k]} uploaded.`,
                            );
                          }}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Actions cert={cert} admin={admin} busy={busy} run={run} onDeleted={props.onClose} />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>
        History
      </div>
      <ul className="history">
        {cert.history.map((h, i) => (
          <li key={i}>
            <span className="muted nowrap">{h.at}</span> {ACTION_LABELS[h.action] ?? h.action} by {h.actor}
            <HistoryDetail action={h.action} detail={h.detail} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function HistoryDetail({ action, detail }: { action: string; detail: string }) {
  const d = useMemo(() => {
    try {
      return JSON.parse(detail) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [detail]);
  const bits: string[] = [];
  if (typeof d.kind === 'string') bits.push(DOC_LABELS[d.kind as DocKind] ?? d.kind);
  if (d.changed && typeof d.changed === 'object') bits.push(`changed ${Object.keys(d.changed).join(', ')}`);
  if (typeof d.reason === 'string') bits.push(`reason: ${d.reason}`);
  if (action === 'RELEASE' || !bits.length) return null;
  return <span className="muted"> ({bits.join('; ')})</span>;
}

function StatusBanner({ cert }: { cert: CertificateDto }) {
  if (cert.status === 'VALID') {
    return (
      <div className="notice ok">
        <StatusPill status="VALID" /> Released {manilaDateTime(Date.parse(cert.releasedAt))} by {cert.releasedBy}. A scan of its QR shows it as valid.
      </div>
    );
  }
  if (cert.status === 'REVOKED') {
    return (
      <div className="notice bad">
        <StatusPill status="REVOKED" /> Revoked {manilaDateTime(Date.parse(cert.revokedAt))} by {cert.revokedBy}: {cert.revokeReason}
      </div>
    );
  }
  const missing = DOC_KINDS.filter((k) => !cert.documents.some((d) => d.kind === k));
  return (
    <div className="notice">
      <StatusPill status="DRAFT" />{' '}
      {missing.length
        ? `Next: print the transmittal with its QR, have both signed, then upload the ${missing.map((k) => DOC_LABELS[k].toLowerCase()).join(' and ')}.`
        : 'Both scans are in. Check them, then release the record.'}{' '}
      Until it is released, a scan of the QR says "not yet released".
    </div>
  );
}

function QrPanel({ cert }: { cert: CertificateDto }) {
  const { settings } = useSession();
  const toast = useToast();
  const [printing, setPrinting] = useState(false);
  const svg = useMemo(() => qrSvg(cert.verifyUrl), [cert.verifyUrl]);
  const host = settings.verifyBaseUrl.replace(/^https:\/\//, '').replace(/\/$/, '');
  const base = `${cert.certType}-${cert.certNumber.replace(/[^\w.-]/g, '_')}`;
  return (
    <div className="qr-panel">
      <div className="section-title">QR code for the transmittal</div>
      <div className="qr-row">
        <svg viewBox={`0 0 ${svg.size} ${svg.size}`} className="qr" role="img" aria-label={`QR code for ${cert.verifyUrl}`} shapeRendering="crispEdges">
          <rect width={svg.size} height={svg.size} fill="#fff" />
          <path d={svg.path} fill="#000" />
        </svg>
        <div>
          <div className="muted small">Verification code</div>
          <div className="code-big">{formatCode(cert.code)}</div>
          <div className="muted small" style={{ wordBreak: 'break-all' }}>
            {cert.verifyUrl}
          </div>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        <button className="btn primary small-btn" onClick={() => setPrinting(true)}>
          Print transmittal with QR
        </button>
        <button className="btn small-btn" onClick={() => void qrLabelPng(cert.verifyUrl, cert.code, host, `${cert.certType} No. ${cert.certNumber}`).then((u) => downloadDataUrl(u, `${base}-QR-label.png`))}>
          Download label (PNG)
        </button>
        <button className="btn small-btn" onClick={() => downloadDataUrl(qrPng(cert.verifyUrl), `${base}-QR.png`)}>
          QR only (PNG)
        </button>
        <button
          className="btn small-btn"
          onClick={() =>
            navigator.clipboard?.writeText(cert.verifyUrl).then(
              () => toast('Link copied.'),
              () => toast('Copy the link from the box above.'),
            )
          }
        >
          Copy link
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>
        Print the transmittal here, or, for a transmittal made in Word, insert the label (Insert → Pictures) at about 6 cm wide.
      </p>
      {printing && <TransmittalModal cert={cert} onClose={() => setPrinting(false)} />}
    </div>
  );
}

function Actions(props: { cert: CertificateDto; admin: boolean; busy: string; run: (label: string, fn: () => Promise<CertificateDto | void>, done?: string) => Promise<boolean>; onDeleted: () => void }) {
  const { cert, admin, busy, run } = props;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [why, setWhy] = useState('');
  const ready = DOC_KINDS.every((k) => cert.documents.some((d) => d.kind === k));
  if (cert.status === 'DRAFT') {
    return (
      <div className="action-box">
        <button className="btn primary block" disabled={!ready || !!busy} onClick={() => void run('release', () => api('api_release', { certId: cert.certId }), 'Released. A scan now shows the certificate as valid.')}>
          {busy === 'release' ? 'Releasing…' : 'Release: show as valid when scanned'}
        </button>
        {!ready && <div className="hint">Upload both signed scans to release.</div>}
        <div style={{ marginTop: 10 }}>
          {confirmDelete ? (
            <div className="actions">
              <button
                className="btn danger"
                disabled={!!busy}
                onClick={() =>
                  void run('delete', async () => {
                    await api('api_deleteDraft', { certId: cert.certId });
                  }, 'Draft deleted.').then((ok) => ok && props.onDeleted())
                }
              >
                Yes, delete the draft
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button className="btn danger small-btn" onClick={() => setConfirmDelete(true)}>
              Delete draft
            </button>
          )}
        </div>
      </div>
    );
  }
  if (cert.status === 'VALID' && admin) {
    return (
      <div className="action-box">
        {revoking ? (
          <>
            <Field label="Reason for revoking" hint="Shown on the public page, e.g. Superseded by LS-R10-2026-0150.">
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} />
            </Field>
            <div className="actions">
              <button className="btn danger" disabled={!why.trim() || !!busy} onClick={() => void run('revoke', () => api('api_revoke', { certId: cert.certId, reason: why }), 'Revoked. A scan now shows it as revoked.')}>
                {busy === 'revoke' ? 'Revoking…' : 'Revoke this certificate'}
              </button>
              <button className="btn" onClick={() => setRevoking(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button className="btn danger small-btn" onClick={() => setRevoking(true)}>
            Revoke or cancel…
          </button>
        )}
      </div>
    );
  }
  return null;
}
