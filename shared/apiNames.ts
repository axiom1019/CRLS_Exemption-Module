import type { ApiName, VerifyName } from './api';

/** Every staff API function. build-backend.mjs reads this list to create the Apps Script entry points. */
export const API_NAMES = [
  'api_session',
  'api_requestCode',
  'api_verifyCode',
  'api_signOut',
  'api_listCertificates',
  'api_getCertificate',
  'api_createCertificate',
  'api_updateCertificate',
  'api_uploadDocument',
  'api_downloadDocument',
  'api_release',
  'api_revoke',
  'api_deleteDraft',
  'api_listUsers',
  'api_saveUser',
  'api_getSettings',
  'api_saveSettings',
  'api_audit',
] as const satisfies readonly ApiName[];

/** Every public verify function (separate Apps Script project). */
export const VERIFY_NAMES = ['verify_info', 'verify_lookup', 'verify_document'] as const satisfies readonly VerifyName[];

type Missing = Exclude<ApiName, (typeof API_NAMES)[number]>;
type MissingV = Exclude<VerifyName, (typeof VERIFY_NAMES)[number]>;
// Compile error here if a name in a contract is missing from the lists above.
export const _allListed: Missing extends never ? true : Missing = true;
export const _allVerifyListed: MissingV extends never ? true : MissingV = true;
