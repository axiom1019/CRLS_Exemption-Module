/* Row ↔ object mapping. Sheets hold text only; everything is parsed here. */
import type { CertificateSummary, DocumentDto, SettingsDto, UserDto } from '@shared/api';
import { CERT_STATUSES, CERT_TYPES, ROLES, type CertStatus, type CertType, type Role } from '@shared/constants';
import { bool, boolCell, int, intCell } from '../repository/cells';
import type { RowOf } from '../repository/schema';
import type { Db, Deps } from '../platform/types';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  position: string;
  roles: Role[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export function toUser(r: RowOf<'Users'>): User {
  return {
    userId: r.user_id,
    email: r.email.trim().toLowerCase(),
    fullName: r.full_name,
    position: r.position,
    roles: r.roles
      .split(',')
      .map((x) => x.trim())
      .filter((x): x is Role => (ROLES as readonly string[]).includes(x)),
    isActive: bool(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: int(r.version, 1),
  };
}

export function userRow(u: User): RowOf<'Users'> {
  return {
    user_id: u.userId,
    email: u.email,
    full_name: u.fullName,
    position: u.position,
    roles: u.roles.join(','),
    is_active: boolCell(u.isActive),
    created_at: u.createdAt,
    updated_at: u.updatedAt,
    version: intCell(u.version),
  };
}

export const userDto = (u: User): UserDto => ({
  userId: u.userId,
  email: u.email,
  fullName: u.fullName,
  position: u.position,
  roles: u.roles,
  isActive: u.isActive,
  version: u.version,
});

/** A stored scan. fileId stays inside the backend; the browser never sees Drive IDs. */
export interface StoredDocument extends DocumentDto {
  fileId: string;
}

export interface Certificate {
  certId: string;
  code: string;
  certType: CertType;
  certNumber: string;
  dateIssued: string;
  transmittalNumber: string;
  transmittalDate: string;
  recipientName: string;
  recipientAddress: string;
  projectName: string;
  projectLocation: string;
  developerName: string;
  coverage: string;
  remarks: string;
  status: CertStatus;
  documents: StoredDocument[];
  createdBy: string;
  createdAt: string;
  releasedAt: string;
  releasedBy: string;
  revokedAt: string;
  revokedBy: string;
  revokeReason: string;
  idempotencyKey: string;
  updatedAt: string;
  version: number;
}

function parseDocs(json: string): StoredDocument[] {
  try {
    const v = JSON.parse(json || '[]') as unknown;
    return Array.isArray(v) ? (v as StoredDocument[]) : [];
  } catch {
    return [];
  }
}

export function toCertificate(r: RowOf<'Certificates'>): Certificate {
  return {
    certId: r.cert_id,
    code: r.code,
    certType: ((CERT_TYPES as readonly string[]).includes(r.cert_type) ? r.cert_type : 'LS') as CertType,
    certNumber: r.cert_number,
    dateIssued: r.date_issued,
    transmittalNumber: r.transmittal_number,
    transmittalDate: r.transmittal_date,
    recipientName: r.recipient_name ?? '',
    recipientAddress: r.recipient_address ?? '',
    projectName: r.project_name,
    projectLocation: r.project_location,
    developerName: r.developer_name,
    coverage: r.coverage,
    remarks: r.remarks,
    status: ((CERT_STATUSES as readonly string[]).includes(r.status) ? r.status : 'DRAFT') as CertStatus,
    documents: parseDocs(r.documents_json),
    createdBy: r.created_by,
    createdAt: r.created_at,
    releasedAt: r.released_at,
    releasedBy: r.released_by,
    revokedAt: r.revoked_at,
    revokedBy: r.revoked_by,
    revokeReason: r.revoke_reason,
    idempotencyKey: r.idempotency_key,
    updatedAt: r.updated_at,
    version: int(r.version, 1),
  };
}

export function certificateRow(c: Certificate): RowOf<'Certificates'> {
  return {
    cert_id: c.certId,
    code: c.code,
    cert_type: c.certType,
    cert_number: c.certNumber,
    date_issued: c.dateIssued,
    transmittal_number: c.transmittalNumber,
    transmittal_date: c.transmittalDate,
    recipient_name: c.recipientName,
    recipient_address: c.recipientAddress,
    project_name: c.projectName,
    project_location: c.projectLocation,
    developer_name: c.developerName,
    coverage: c.coverage,
    remarks: c.remarks,
    status: c.status,
    documents_json: JSON.stringify(c.documents),
    created_by: c.createdBy,
    created_at: c.createdAt,
    released_at: c.releasedAt,
    released_by: c.releasedBy,
    revoked_at: c.revokedAt,
    revoked_by: c.revokedBy,
    revoke_reason: c.revokeReason,
    idempotency_key: c.idempotencyKey,
    updated_at: c.updatedAt,
    version: intCell(c.version),
  };
}

export const publicDoc = (d: StoredDocument): DocumentDto => ({
  kind: d.kind,
  fileName: d.fileName,
  sizeBytes: d.sizeBytes,
  sha256: d.sha256,
  uploadedAt: d.uploadedAt,
  uploadedBy: d.uploadedBy,
});

export const summary = (c: Certificate): CertificateSummary => ({
  certId: c.certId,
  code: c.code,
  certType: c.certType,
  certNumber: c.certNumber,
  dateIssued: c.dateIssued,
  projectName: c.projectName,
  developerName: c.developerName,
  status: c.status,
  hasCertificate: c.documents.some((d) => d.kind === 'CERTIFICATE'),
  hasTransmittal: c.documents.some((d) => d.kind === 'TRANSMITTAL'),
  updatedAt: c.updatedAt,
});

// ---- settings (key/value sheet)

export const DEFAULT_SETTINGS: SettingsDto = {
  officeName: 'DHSUD Regional Office X, Cagayan de Oro City',
  contact: '',
  verifyBaseUrl: 'https://dhsudr10.axiomaip.com/v/',
  showDocumentsPublicly: true,
  officeAddress: 'Cagayan de Oro City',
  divisionName: 'Housing and Real Estate Development Regulation Division',
  signatoryName: '',
  signatoryTitle: 'Regional Director',
};

export function readSettings(db: Db): SettingsDto {
  const kv = new Map(db.readAll('Settings').map((r) => [r.key, r.value]));
  return {
    officeName: kv.get('officeName') || DEFAULT_SETTINGS.officeName,
    contact: kv.get('contact') ?? DEFAULT_SETTINGS.contact,
    verifyBaseUrl: kv.get('verifyBaseUrl') || DEFAULT_SETTINGS.verifyBaseUrl,
    showDocumentsPublicly: kv.has('showDocumentsPublicly') ? kv.get('showDocumentsPublicly') === 'TRUE' : DEFAULT_SETTINGS.showDocumentsPublicly,
    officeAddress: kv.get('officeAddress') ?? DEFAULT_SETTINGS.officeAddress,
    divisionName: kv.get('divisionName') ?? DEFAULT_SETTINGS.divisionName,
    signatoryName: kv.get('signatoryName') ?? DEFAULT_SETTINGS.signatoryName,
    signatoryTitle: kv.get('signatoryTitle') ?? DEFAULT_SETTINGS.signatoryTitle,
  };
}

export function writeSettings(deps: Deps, db: Db, s: SettingsDto, by: string): void {
  const now = new Date(deps.nowMs()).toISOString();
  const values: Record<string, string> = {
    officeName: s.officeName,
    contact: s.contact,
    verifyBaseUrl: s.verifyBaseUrl,
    showDocumentsPublicly: boolCell(s.showDocumentsPublicly),
    officeAddress: s.officeAddress,
    divisionName: s.divisionName,
    signatoryName: s.signatoryName,
    signatoryTitle: s.signatoryTitle,
  };
  for (const [key, value] of Object.entries(values)) {
    const row = { key, value, updated_by: by, updated_at: now };
    if (!db.replace('Settings', key, row)) db.append('Settings', row);
  }
}
