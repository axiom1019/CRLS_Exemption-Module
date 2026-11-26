/*
 * Staff API entry points: parse input → identify caller → call a service → wrap the result.
 * Every input may carry `token` (the session token from code sign-in). The backend never trusts
 * the browser's own validation; each input is parsed again here.
 */
import type { ApiContract, ApiName, ApiResult, Me } from '@shared/api';
import * as S from '@shared/schemas';
import type { Deps } from '../platform/types';
import { listAudit } from '../services/audit';
import { currentCaller, requestCode, requireCaller, requireRole, signOut, verifyCode, type Caller } from '../services/auth';
import * as certs from '../services/certificates';
import { AppError } from '../services/errors';
import { userDto } from '../services/model';
import * as users from '../services/users';
import { parse, tokenOf, wrap } from './wrap';

type Out<K extends ApiName> = ApiContract[K][1];
export type Endpoints = { [K in ApiName]: (deps: Deps, input: unknown) => ApiResult<Out<K>> };

/** Signed-in endpoint. */
function authed<K extends ApiName>(name: K, fn: (deps: Deps, c: Caller, input: unknown) => Out<K>) {
  return wrap<Out<K>>(name, (deps, input) => fn(deps, requireCaller(deps, tokenOf(input)), input));
}

const buildMe = (c: Caller): Me => ({ user: { ...userDto(c.user), roles: [...c.roles] }, isOwner: c.isOwner });

export const endpoints: Endpoints = {
  api_session: wrap('api_session', (deps, input) => {
    if (!deps.db.isInitialized()) return { initialized: false, me: null, googleEmail: '', denied: false, environment: deps.environment, settings: null };
    const c = currentCaller(deps, tokenOf(input));
    const googleEmail = deps.identity.activeEmail();
    return { initialized: true, me: c ? buildMe(c) : null, googleEmail, denied: !c && !!googleEmail, environment: deps.environment, settings: c ? users.getSettings(deps) : null };
  }),
  api_requestCode: wrap('api_requestCode', (deps, input) => requestCode(deps, parse(S.requestCodeInput, input).email)),
  api_verifyCode: wrap('api_verifyCode', (deps, input) => {
    const v = parse(S.verifyCodeInput, input);
    const { token } = verifyCode(deps, v.email, v.code);
    const c = currentCaller(deps, token);
    if (!c) throw new AppError('UNAUTHENTICATED', 'Sign-in failed. Try again.');
    return { token, me: buildMe(c) };
  }),
  api_signOut: wrap('api_signOut', (deps, input) => {
    signOut(deps, tokenOf(input));
    return { ok: true as const };
  }),
  api_listCertificates: authed('api_listCertificates', (deps, c, input) => certs.list(deps, c, parse(S.listInput, input))),
  api_getCertificate: authed('api_getCertificate', (deps, c, input) => certs.get(deps, c, parse(S.certRef, input).certId)),
  api_createCertificate: authed('api_createCertificate', (deps, c, input) => {
    const v = parse(S.createCertificateInput, input);
    return certs.create(deps, c, v.idempotencyKey, v.form);
  }),
  api_updateCertificate: authed('api_updateCertificate', (deps, c, input) => {
    const v = parse(S.updateCertificateInput, input);
    return certs.update(deps, c, v.certId, v.version, v.form, v.reason);
  }),
  api_uploadDocument: authed('api_uploadDocument', (deps, c, input) => certs.upload(deps, c, parse(S.uploadInput, input))),
  api_downloadDocument: authed('api_downloadDocument', (deps, c, input) => {
    const v = parse(S.documentRef, input);
    return certs.download(deps, c, v.certId, v.kind);
  }),
  api_release: authed('api_release', (deps, c, input) => certs.release(deps, c, parse(S.certRef, input).certId)),
  api_revoke: authed('api_revoke', (deps, c, input) => {
    const v = parse(S.revokeInput, input);
    return certs.revoke(deps, c, v.certId, v.reason);
  }),
  api_deleteDraft: authed('api_deleteDraft', (deps, c, input) => certs.deleteDraft(deps, c, parse(S.certRef, input).certId)),
  api_listUsers: authed('api_listUsers', (deps, c) => users.listUsers(deps, c)),
  api_saveUser: authed('api_saveUser', (deps, c, input) => users.saveUser(deps, c, parse(S.saveUserInput, input))),
  api_getSettings: authed('api_getSettings', (deps) => users.getSettings(deps)),
  api_saveSettings: authed('api_saveSettings', (deps, c, input) => users.saveSettings(deps, c, parse(S.settingsInput, input))),
  api_audit: authed('api_audit', (deps, c, input) => {
    requireRole(c, 'ADMIN');
    const v = parse(S.auditInput, input);
    return listAudit(deps, v.entityId, v.limit);
  }),
};
