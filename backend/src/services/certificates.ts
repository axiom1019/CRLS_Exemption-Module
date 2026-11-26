/*
 * Certificate records: encode (draft) → upload signed scans → release (valid) → revoke if needed.
 *
 * Rules:
 *  - Encoders edit a record and replace its scans only while it is a draft.
 *  - Release needs both signed scans. After release, only an administrator can correct details or
 *    replace a scan, and must give a reason; it is written to the audit log.
 *  - Only an administrator revokes. A revoked record stays visible to the public as revoked.
 *  - Drafts can be deleted (the QR then shows "not found"); released records never are.
 */
import type { CertificateDto, CertificateSummary } from '@shared/api';
import { codeFromHex, verifyUrl } from '@shared/codes';
import { CERT_TYPE_LABELS, DOC_LABELS, MAX_PDF_BYTES, type CertStatus, type CertType, type DocKind } from '@shared/constants';
import type { CertificateForm } from '@shared/schemas';
import type { Deps } from '../platform/types';
import { audit, listAudit } from './audit';
import { requireRole, type Caller } from './auth';
import { AppError } from './errors';
import { certificateRow, publicDoc, readSettings, summary, toCertificate, type Certificate } from './model';

const nowIso = (deps: Deps) => new Date(deps.nowMs()).toISOString();
const isAdmin = (c: Caller) => c.roles.has('ADMIN');

function load(deps: Deps, certId: string): Certificate {
  const row = deps.db.get().findOne('Certificates', 'cert_id', certId);
  if (!row) throw new AppError('NOT_FOUND', 'That record no longer exists.');
  return toCertificate(row);
}

function save(deps: Deps, c: Certificate): void {
  if (!deps.db.get().replace('Certificates', c.certId, certificateRow(c))) throw new AppError('NOT_FOUND', 'That record no longer exists.');
}

export function toDto(deps: Deps, c: Certificate, withHistory = true): CertificateDto {
  const settings = readSettings(deps.db.get());
  return {
    ...summary(c),
    transmittalNumber: c.transmittalNumber,
    transmittalDate: c.transmittalDate,
    recipientName: c.recipientName,
    recipientAddress: c.recipientAddress,
    projectLocation: c.projectLocation,
    coverage: c.coverage,
    remarks: c.remarks,
    documents: c.documents.map(publicDoc),
    verifyUrl: verifyUrl(settings.verifyBaseUrl, c.code),
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    releasedAt: c.releasedAt,
    releasedBy: c.releasedBy,
    revokedAt: c.revokedAt,
    revokedBy: c.revokedBy,
    revokeReason: c.revokeReason,
    version: c.version,
    history: withHistory ? listAudit(deps, c.certId, 100) : [],
  };
}

/** A new unguessable code that no record uses yet. */
function newCode(deps: Deps, used: ReadonlySet<string>): string {
  for (let i = 0; i < 5; i++) {
    const code = codeFromHex(deps.randomToken());
    if (!used.has(code)) return code;
  }
  throw new AppError('INTERNAL', 'Could not create a unique code. Try again.');
}

const sameNumber = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

function assertUniqueNumber(all: Certificate[], certType: CertType, certNumber: string, exceptId?: string): void {
  const dup = all.find((c) => c.certId !== exceptId && c.certType === certType && sameNumber(c.certNumber, certNumber));
  if (dup) {
    throw new AppError('CONFLICT', `${CERT_TYPE_LABELS[certType]} No. ${dup.certNumber} is already recorded.`, { fields: { certNumber: 'Already recorded' } });
  }
}

function applyForm(c: Certificate, f: CertificateForm): void {
  c.certType = f.certType;
  c.certNumber = f.certNumber;
  c.dateIssued = f.dateIssued;
  c.transmittalNumber = f.transmittalNumber;
  c.transmittalDate = f.transmittalDate;
  c.recipientName = f.recipientName;
  c.recipientAddress = f.recipientAddress;
  c.projectName = f.projectName;
  c.projectLocation = f.projectLocation;
  c.developerName = f.developerName;
  c.coverage = f.coverage;
  c.remarks = f.remarks;
}

export function list(deps: Deps, caller: Caller, f: { q?: string; certType?: CertType; status?: CertStatus }): CertificateSummary[] {
  requireRole(caller, 'ENCODER', 'ADMIN');
  const q = (f.q ?? '').trim().toLowerCase();
  return deps.db
    .get()
    .readAll('Certificates')
    .map(toCertificate)
    .filter((c) => (!f.certType || c.certType === f.certType) && (!f.status || c.status === f.status))
    .filter((c) => !q || [c.certNumber, c.projectName, c.developerName, c.projectLocation, c.transmittalNumber, c.code].some((v) => v.toLowerCase().includes(q.replace(/-/g, '')) || v.toLowerCase().includes(q)))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 500)
    .map(summary);
}

export function get(deps: Deps, caller: Caller, certId: string): CertificateDto {
  requireRole(caller, 'ENCODER', 'ADMIN');
  return toDto(deps, load(deps, certId));
}

export function create(deps: Deps, caller: Caller, idempotencyKey: string, form: CertificateForm): CertificateDto {
  requireRole(caller, 'ENCODER', 'ADMIN');
  const certId = deps.lock.run(() => {
    const db = deps.db.get();
    const all = db.readAll('Certificates').map(toCertificate);
    const again = all.find((c) => c.idempotencyKey === idempotencyKey);
    if (again) return again.certId;
    assertUniqueNumber(all, form.certType, form.certNumber);
    const now = nowIso(deps);
    const c: Certificate = {
      certId: deps.uuid(),
      code: newCode(deps, new Set(all.map((x) => x.code))),
      certType: form.certType,
      certNumber: '',
      dateIssued: '',
      transmittalNumber: '',
      transmittalDate: '',
      recipientName: '',
      recipientAddress: '',
      projectName: '',
      projectLocation: '',
      developerName: '',
      coverage: '',
      remarks: '',
      status: 'DRAFT',
      documents: [],
      createdBy: caller.email,
      createdAt: now,
      releasedAt: '',
      releasedBy: '',
      revokedAt: '',
      revokedBy: '',
      revokeReason: '',
      idempotencyKey,
      updatedAt: now,
      version: 1,
    };
    applyForm(c, form);
    db.append('Certificates', certificateRow(c));
    audit(deps, caller.user.userId, caller.email, 'CREATE', c.certId, { certType: c.certType, certNumber: c.certNumber });
    return c.certId;
  });
  return toDto(deps, load(deps, certId));
}

/** Drafts: any encoder. Released or revoked: administrator only, with a reason. */
function assertCanChange(caller: Caller, c: Certificate, reason: string | undefined, what: string): void {
  if (c.status === 'DRAFT') return;
  if (!isAdmin(caller)) throw new AppError('FORBIDDEN', `This record is already ${c.status === 'VALID' ? 'released' : 'revoked'}. Only an administrator can ${what}.`);
  if (!reason?.trim()) throw new AppError('VALIDATION', 'Give the reason for changing a released record.', { fields: { reason: 'Required' } });
}

export function update(deps: Deps, caller: Caller, certId: string, version: number, form: CertificateForm, reason?: string): CertificateDto {
  requireRole(caller, 'ENCODER', 'ADMIN');
  deps.lock.run(() => {
    const c = load(deps, certId);
    if (c.version !== version) throw new AppError('STALE_VERSION', 'Someone else changed this record. Close it and open it again.');
    assertCanChange(caller, c, reason, 'correct its details');
    const all = deps.db.get().readAll('Certificates').map(toCertificate);
    assertUniqueNumber(all, form.certType, form.certNumber, c.certId);
    const before = { ...c };
    applyForm(c, form);
    const changed = (Object.keys(form) as (keyof CertificateForm)[]).filter((k) => before[k] !== c[k]);
    if (!changed.length) return;
    c.updatedAt = nowIso(deps);
    c.version++;
    save(deps, c);
    audit(deps, caller.user.userId, caller.email, before.status === 'DRAFT' ? 'EDIT' : 'CORRECT', c.certId, {
      changed: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: c[k] }])),
      ...(reason ? { reason } : {}),
    });
  });
  return toDto(deps, load(deps, certId));
}

/** True when the bytes start like a PDF ("%PDF-"). */
function looksLikePdf(base64: string): boolean {
  return base64.startsWith('JVBERi0');
}

export function upload(deps: Deps, caller: Caller, input: { certId: string; kind: DocKind; fileName: string; base64: string; reason?: string }): CertificateDto {
  requireRole(caller, 'ENCODER', 'ADMIN');
  const base64 = input.base64.replace(/\s/g, '');
  if (!looksLikePdf(base64)) throw new AppError('VALIDATION', 'Upload the scan as a PDF file.');
  const sizeBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (sizeBytes > MAX_PDF_BYTES) throw new AppError('VALIDATION', `The file is too large (${(sizeBytes / 1048576).toFixed(1)} MB). Scan at 200 to 300 dpi to keep it under ${MAX_PDF_BYTES / 1048576} MB.`);

  // Check permissions before the slow Drive write, then check again inside the lock.
  const first = load(deps, input.certId);
  assertCanChange(caller, first, input.reason, 'replace a scan');
  const sha256 = deps.sha256Base64(base64);
  const safeName = input.fileName.replace(/[^\w .()-]/g, '_').slice(0, 120);
  const storedName = `${first.certType} ${first.certNumber.replace(/[^\w.-]/g, '_')} - ${DOC_LABELS[input.kind]} - ${first.code}.pdf`;
  const fileId = deps.files.save(storedName, base64, 'application/pdf');

  let replaced: string | null = null;
  try {
    deps.lock.run(() => {
      const c = load(deps, input.certId);
      assertCanChange(caller, c, input.reason, 'replace a scan');
      const old = c.documents.find((d) => d.kind === input.kind);
      replaced = old?.fileId ?? null;
      c.documents = [
        ...c.documents.filter((d) => d.kind !== input.kind),
        { kind: input.kind, fileName: safeName, sizeBytes, sha256, uploadedAt: nowIso(deps), uploadedBy: caller.email, fileId },
      ];
      c.updatedAt = nowIso(deps);
      c.version++;
      save(deps, c);
      audit(deps, caller.user.userId, caller.email, old ? 'REPLACE_SCAN' : 'UPLOAD_SCAN', c.certId, {
        kind: input.kind,
        fileName: safeName,
        sha256,
        ...(old ? { previousSha256: old.sha256 } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      });
    });
  } catch (e) {
    deps.files.trash(fileId);
    throw e;
  }
  // A replaced draft scan was never public, so it is removed. A replaced released scan is kept
  // in the restricted folder (the audit log points to its fingerprint).
  if (replaced && first.status === 'DRAFT') {
    try {
      deps.files.trash(replaced);
    } catch {
      /* already gone */
    }
  }
  return toDto(deps, load(deps, input.certId));
}

export function download(deps: Deps, caller: Caller, certId: string, kind: DocKind): { base64: string; fileName: string } {
  requireRole(caller, 'ENCODER', 'ADMIN');
  const c = load(deps, certId);
  const d = c.documents.find((x) => x.kind === kind);
  if (!d) throw new AppError('NOT_FOUND', 'That scan has not been uploaded.');
  const base64 = deps.files.readBase64(d.fileId);
  if (!base64) throw new AppError('NOT_FOUND', 'The file could not be read from Drive.');
  return { base64, fileName: `${c.certType}-${c.certNumber.replace(/[^\w.-]/g, '_')}-${kind.toLowerCase()}.pdf` };
}

export function release(deps: Deps, caller: Caller, certId: string): CertificateDto {
  requireRole(caller, 'ENCODER', 'ADMIN');
  deps.lock.run(() => {
    const c = load(deps, certId);
    if (c.status !== 'DRAFT') throw new AppError('CONFLICT', 'This record was already released.');
    const missing = (['CERTIFICATE', 'TRANSMITTAL'] as const).filter((k) => !c.documents.some((d) => d.kind === k));
    if (missing.length) throw new AppError('VALIDATION', `Upload the ${missing.map((k) => DOC_LABELS[k].toLowerCase()).join(' and the ')} first.`);
    c.status = 'VALID';
    c.releasedAt = nowIso(deps);
    c.releasedBy = caller.email;
    c.updatedAt = c.releasedAt;
    c.version++;
    save(deps, c);
    audit(deps, caller.user.userId, caller.email, 'RELEASE', c.certId, { documents: c.documents.map((d) => ({ kind: d.kind, sha256: d.sha256 })) });
  });
  return toDto(deps, load(deps, certId));
}

export function revoke(deps: Deps, caller: Caller, certId: string, reason: string): CertificateDto {
  requireRole(caller, 'ADMIN');
  deps.lock.run(() => {
    const c = load(deps, certId);
    if (c.status !== 'VALID') throw new AppError('CONFLICT', c.status === 'DRAFT' ? 'A draft is not released yet. Delete it instead.' : 'This record is already revoked.');
    c.status = 'REVOKED';
    c.revokedAt = nowIso(deps);
    c.revokedBy = caller.email;
    c.revokeReason = reason;
    c.updatedAt = c.revokedAt;
    c.version++;
    save(deps, c);
    audit(deps, caller.user.userId, caller.email, 'REVOKE', c.certId, { reason });
  });
  return toDto(deps, load(deps, certId));
}

export function deleteDraft(deps: Deps, caller: Caller, certId: string): { ok: true } {
  requireRole(caller, 'ENCODER', 'ADMIN');
  const fileIds = deps.lock.run(() => {
    const c = load(deps, certId);
    if (c.status !== 'DRAFT') throw new AppError('CONFLICT', 'Only a draft can be deleted. Revoke a released record instead.');
    deps.db.get().deleteRows('Certificates', (r) => r.cert_id === certId);
    audit(deps, caller.user.userId, caller.email, 'DELETE_DRAFT', certId, { certType: c.certType, certNumber: c.certNumber, code: c.code });
    return c.documents.map((d) => d.fileId);
  });
  for (const id of fileIds) {
    try {
      deps.files.trash(id);
    } catch {
      /* already gone */
    }
  }
  return { ok: true };
}
