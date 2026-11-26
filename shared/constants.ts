export const APP_NAME = 'Certificate Verification';
export const TIMEZONE = 'Asia/Manila';
/** The Philippines has no daylight saving time, so Manila is always UTC+8. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION',
  'CONFLICT',
  'NOT_FOUND',
  'STALE_VERSION',
  'BUSY',
  'RATE_LIMITED',
  'NOT_INITIALIZED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** ENCODER records certificates and uploads scans; ADMIN also manages people, settings and revocations. */
export const ROLES = ['ENCODER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { ENCODER: 'Encoder', ADMIN: 'Administrator' };

export const CERT_TYPES = ['LS', 'ELS', 'CNO'] as const;
export type CertType = (typeof CERT_TYPES)[number];
export const CERT_TYPE_LABELS: Record<CertType, string> = {
  LS: 'License to Sell',
  ELS: 'Exemption to License to Sell',
  CNO: 'Certificate of No Objection',
};

/** DRAFT: encoded, QR issued, not yet valid. VALID: released. REVOKED: withdrawn by the office. */
export const CERT_STATUSES = ['DRAFT', 'VALID', 'REVOKED'] as const;
export type CertStatus = (typeof CERT_STATUSES)[number];
export const STATUS_LABELS: Record<CertStatus, string> = { DRAFT: 'Draft, not released', VALID: 'Valid', REVOKED: 'Revoked' };

export const DOC_KINDS = ['CERTIFICATE', 'TRANSMITTAL'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABELS: Record<DocKind, string> = { CERTIFICATE: 'Signed certificate', TRANSMITTAL: 'Signed transmittal' };

/** Uploads travel through google.script.run as base64; keep each scan modest. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Default domain treated as govmail (DHSUD Google Workspace). */
export const GOVMAIL_DOMAIN = 'dhsud.gov.ph';

/** Apps Script CacheService keeps an entry 6 hours at most. */
export const SESSION_HOURS = 6;
export const CODE_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_MAX_SENDS_PER_HOUR = 5;
