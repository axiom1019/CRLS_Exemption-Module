import { z } from 'zod';
import { CERT_TYPES, DOC_KINDS, ROLES } from './constants';
import { isValidIsoDate } from './dates';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);
const isoDate = z.string().refine(isValidIsoDate, 'Use a valid date');
const optionalDate = z.union([z.literal(''), isoDate]);
const id = z.string().trim().min(1).max(64);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address');

export const requestCodeInput = z.object({ email });
export const verifyCodeInput = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const certificateForm = z.object({
  certType: z.enum(CERT_TYPES),
  certNumber: required(60, 'Enter the certificate number'),
  dateIssued: isoDate,
  transmittalNumber: text(60),
  transmittalDate: optionalDate,
  recipientName: text(200).default(''),
  recipientAddress: text(400).default(''),
  projectName: required(200, 'Enter the project name'),
  projectLocation: required(300, 'Enter the location'),
  developerName: required(200, 'Enter the owner or developer'),
  coverage: text(300),
  remarks: text(1000),
});
export type CertificateForm = z.infer<typeof certificateForm>;

export const createCertificateInput = z.object({ idempotencyKey: z.string().uuid(), form: certificateForm });
export const updateCertificateInput = z.object({
  certId: id,
  version: z.number().int().min(1),
  form: certificateForm,
  /** Required when the administrator corrects a released record. */
  reason: text(300).optional(),
});
export const certRef = z.object({ certId: id });
export const uploadInput = z.object({
  certId: id,
  kind: z.enum(DOC_KINDS),
  fileName: required(200, 'File name is missing'),
  base64: z.string().min(8).max(15_000_000),
  reason: text(300).optional(),
});
export const documentRef = z.object({ certId: id, kind: z.enum(DOC_KINDS) });
export const revokeInput = z.object({ certId: id, reason: required(300, 'Give the reason') });
export const listInput = z.object({
  q: text(100).optional(),
  certType: z.enum(CERT_TYPES).optional(),
  status: z.enum(['DRAFT', 'VALID', 'REVOKED']).optional(),
});

export const saveUserInput = z.object({
  userId: id.optional(),
  email,
  fullName: required(120, 'Enter the name'),
  position: text(120),
  roles: z.array(z.enum(ROLES)).max(ROLES.length),
  isActive: z.boolean(),
});

export const settingsInput = z.object({
  officeName: required(200, 'Enter the office name'),
  contact: text(300),
  verifyBaseUrl: z
    .string()
    .trim()
    .max(200)
    .regex(/^https:\/\/[^\s]+\/$/, 'Use an https address that ends with a slash, e.g. https://dhsudr10.axiomaip.com/v/'),
  showDocumentsPublicly: z.boolean(),
  officeAddress: text(300).default(''),
  divisionName: text(200).default(''),
  signatoryName: text(120).default(''),
  signatoryTitle: text(160).default(''),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const auditInput = z.object({ entityId: id.optional(), limit: z.number().int().min(1).max(1000).optional() });

/** Public verify page. */
export const verifyLookupInput = z.object({ code: z.string().max(40) });
export const verifyDocumentInput = z.object({ code: z.string().max(40), kind: z.enum(DOC_KINDS) });
