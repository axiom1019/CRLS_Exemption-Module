import type { CertStatus, CertType, DocKind, ErrorCode, Role } from './constants';
import type { z } from 'zod';
import type * as S from './schemas';

export type ApiError = { code: ErrorCode; message: string; details?: unknown };
export type ApiResult<T> = { ok: true; data: T; requestId: string } | { ok: false; error: ApiError; requestId: string };

export interface UserDto {
  userId: string;
  email: string;
  fullName: string;
  position: string;
  roles: Role[];
  isActive: boolean;
  version: number;
}

export interface SettingsDto {
  officeName: string;
  contact: string;
  verifyBaseUrl: string;
  showDocumentsPublicly: boolean;
  officeAddress: string;
  divisionName: string;
  signatoryName: string;
  signatoryTitle: string;
}

export interface DocumentDto {
  kind: DocKind;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface CertificateSummary {
  certId: string;
  code: string;
  certType: CertType;
  certNumber: string;
  dateIssued: string;
  projectName: string;
  developerName: string;
  status: CertStatus;
  hasCertificate: boolean;
  hasTransmittal: boolean;
  updatedAt: string;
}

export interface CertificateDto extends CertificateSummary {
  transmittalNumber: string;
  transmittalDate: string;
  recipientName: string;
  recipientAddress: string;
  projectLocation: string;
  coverage: string;
  remarks: string;
  documents: DocumentDto[];
  verifyUrl: string;
  createdBy: string;
  createdAt: string;
  releasedAt: string;
  releasedBy: string;
  revokedAt: string;
  revokedBy: string;
  revokeReason: string;
  version: number;
  history: AuditDto[];
}

export interface AuditDto {
  at: string;
  actor: string;
  action: string;
  entityId: string;
  detail: string;
}

export interface Me {
  user: UserDto;
  isOwner: boolean;
}

export interface SessionState {
  initialized: boolean;
  me: Me | null;
  googleEmail: string;
  denied: boolean;
  environment: string;
  settings: SettingsDto | null;
}

/** What the public verify page receives. Never includes internal remarks or staff names. */
export interface VerifyResult {
  found: boolean;
  code: string;
  status?: CertStatus;
  certType?: CertType;
  certTypeLabel?: string;
  certNumber?: string;
  dateIssued?: string;
  transmittalNumber?: string;
  transmittalDate?: string;
  projectName?: string;
  projectLocation?: string;
  developerName?: string;
  coverage?: string;
  releasedAt?: string;
  revokedAt?: string;
  revokeReason?: string;
  documents?: { kind: DocKind; label: string; fileName: string; sizeBytes: number; sha256: string }[];
  documentsShown?: boolean;
}

export interface VerifyInfo {
  officeName: string;
  contact: string;
  environment: string;
  privacy: { text: string; approved: boolean };
}

type In<T extends z.ZodType> = z.input<T>;

/** name → [input, output]. Every input may also carry `token`. */
export interface ApiContract {
  api_session: [Record<string, never>, SessionState];
  api_requestCode: [In<typeof S.requestCodeInput>, { sent: true }];
  api_verifyCode: [In<typeof S.verifyCodeInput>, { token: string; me: Me }];
  api_signOut: [Record<string, never>, { ok: true }];
  api_listCertificates: [In<typeof S.listInput>, CertificateSummary[]];
  api_getCertificate: [In<typeof S.certRef>, CertificateDto];
  api_createCertificate: [In<typeof S.createCertificateInput>, CertificateDto];
  api_updateCertificate: [In<typeof S.updateCertificateInput>, CertificateDto];
  api_uploadDocument: [In<typeof S.uploadInput>, CertificateDto];
  api_downloadDocument: [In<typeof S.documentRef>, { base64: string; fileName: string }];
  api_release: [In<typeof S.certRef>, CertificateDto];
  api_revoke: [In<typeof S.revokeInput>, CertificateDto];
  api_deleteDraft: [In<typeof S.certRef>, { ok: true }];
  api_listUsers: [Record<string, never>, UserDto[]];
  api_saveUser: [In<typeof S.saveUserInput>, UserDto];
  api_getSettings: [Record<string, never>, SettingsDto];
  api_saveSettings: [In<typeof S.settingsInput>, SettingsDto];
  api_audit: [In<typeof S.auditInput>, AuditDto[]];
}
export type ApiName = keyof ApiContract;

/** The public, read-only verify app. A separate Apps Script project with no write access. */
export interface VerifyContract {
  verify_info: [Record<string, never>, VerifyInfo];
  verify_lookup: [In<typeof S.verifyLookupInput>, VerifyResult];
  verify_document: [In<typeof S.verifyDocumentInput>, { base64: string; fileName: string }];
}
export type VerifyName = keyof VerifyContract;
