/*
 * The public lookup. Runs in the read-only verify project: it never writes, and it returns only
 * what the paper certificate already shows (no internal remarks, no staff names, no Drive IDs).
 */
import type { VerifyInfo, VerifyResult } from '@shared/api';
import { normalizeCode } from '@shared/codes';
import { CERT_TYPE_LABELS, DOC_LABELS, type DocKind } from '@shared/constants';
import { PRIVACY_NOTICE } from '@shared/privacy';
import type { Deps } from '../platform/types';
import { AppError } from './errors';
import { readSettings, toCertificate, type Certificate } from './model';

function find(deps: Deps, rawCode: string): Certificate | null {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const row = deps.db.get().findOne('Certificates', 'code', code);
  return row ? toCertificate(row) : null;
}

export function info(deps: Deps): VerifyInfo {
  const privacy = { text: PRIVACY_NOTICE.text, approved: PRIVACY_NOTICE.approved };
  if (!deps.db.isInitialized()) return { officeName: 'DHSUD Region 10', contact: '', environment: deps.environment, privacy };
  const s = readSettings(deps.db.get());
  return { officeName: s.officeName, contact: s.contact, environment: deps.environment, privacy };
}

export function lookup(deps: Deps, rawCode: string): VerifyResult {
  if (!deps.db.isInitialized()) throw new AppError('NOT_INITIALIZED', 'The verification service is not set up yet.');
  const code = normalizeCode(rawCode);
  const c = find(deps, rawCode);
  if (!c) return { found: false, code };
  // A draft is not yet an issued certificate: say only that it exists and is not released.
  if (c.status === 'DRAFT') return { found: true, code: c.code, status: 'DRAFT' };
  const shown = readSettings(deps.db.get()).showDocumentsPublicly;
  return {
    found: true,
    code: c.code,
    status: c.status,
    certType: c.certType,
    certTypeLabel: CERT_TYPE_LABELS[c.certType],
    certNumber: c.certNumber,
    dateIssued: c.dateIssued,
    transmittalNumber: c.transmittalNumber,
    transmittalDate: c.transmittalDate,
    projectName: c.projectName,
    projectLocation: c.projectLocation,
    developerName: c.developerName,
    coverage: c.coverage,
    releasedAt: c.releasedAt,
    revokedAt: c.revokedAt,
    revokeReason: c.revokeReason,
    documents: c.documents.map((d) => ({ kind: d.kind, label: DOC_LABELS[d.kind], fileName: d.fileName, sizeBytes: d.sizeBytes, sha256: d.sha256 })),
    documentsShown: shown,
  };
}

export function document(deps: Deps, rawCode: string, kind: DocKind): { base64: string; fileName: string } {
  if (!deps.db.isInitialized()) throw new AppError('NOT_INITIALIZED', 'The verification service is not set up yet.');
  const c = find(deps, rawCode);
  if (!c || c.status === 'DRAFT') throw new AppError('NOT_FOUND', 'No released certificate has this code.');
  if (!readSettings(deps.db.get()).showDocumentsPublicly) throw new AppError('FORBIDDEN', 'The office does not show the documents online. Contact the office for a copy.');
  const d = c.documents.find((x) => x.kind === kind);
  if (!d) throw new AppError('NOT_FOUND', 'That document is not on file.');
  const base64 = deps.files.readBase64(d.fileId);
  if (!base64) throw new AppError('NOT_FOUND', 'The document could not be read. Contact the office.');
  return { base64, fileName: `DHSUD-R10-${c.certType}-${c.certNumber.replace(/[^\w.-]/g, '_')}-${kind.toLowerCase()}.pdf` };
}
