/*
 * Who is calling.
 *
 * The web app runs as the owner account and accepts any Google account. Google tells the app
 * the email of a dhsud.gov.ph user (same Workspace domain as the owner), but withholds it for
 * personal accounts. So:
 *   - govmail users are recognised automatically from their Google sign-in;
 *   - everyone else (staff without govmail, COS staff) proves they own their registered address
 *     with a 6-digit code sent to it, and gets a session token for SESSION_HOURS.
 * Only addresses the administrator registered in Users (and marked active) get in.
 */
import { CODE_MAX_ATTEMPTS, CODE_MAX_SENDS_PER_HOUR, CODE_MINUTES, SESSION_HOURS, type Role } from '@shared/constants';
import type { Deps } from '../platform/types';
import { audit } from './audit';
import { AppError } from './errors';
import { toUser, type User } from './model';

export interface Caller {
  user: User;
  email: string;
  roles: Set<Role>;
  isOwner: boolean;
  via: 'google' | 'code';
}

const sessKey = (deps: Deps, token: string) => `sess:${deps.sha256(token)}`;
const codeKey = (deps: Deps, email: string) => `otp:${deps.sha256(email)}`;
const sendCountKey = (deps: Deps, email: string) => `otpn:${deps.sha256(email)}`;

export function findActiveUserByEmail(deps: Deps, email: string): User | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  const row = deps.db.get().readAll('Users').find((r) => r.email.trim().toLowerCase() === e);
  if (!row) return null;
  const u = toUser(row);
  return u.isActive ? u : null;
}

function callerFor(deps: Deps, user: User, via: Caller['via']): Caller {
  const isOwner = user.email === deps.identity.ownerEmail().toLowerCase();
  const roles = new Set<Role>(user.roles);
  if (isOwner) roles.add('ADMIN');
  // Administrators can do everything an encoder can.
  if (roles.has('ADMIN')) roles.add('ENCODER');
  return { user, email: user.email, roles, isOwner, via };
}

/** The signed-in caller, or null. Never throws for "not signed in". */
export function currentCaller(deps: Deps, token: string | undefined): Caller | null {
  if (!deps.db.isInitialized()) throw new AppError('NOT_INITIALIZED', 'The system has not been set up yet.');
  if (token) {
    const userId = deps.cache.get(sessKey(deps, token));
    if (userId) {
      const row = deps.db.get().findOne('Users', 'user_id', userId);
      const u = row ? toUser(row) : null;
      if (u?.isActive) return callerFor(deps, u, 'code');
    }
  }
  const google = deps.identity.activeEmail();
  const u = findActiveUserByEmail(deps, google);
  return u ? callerFor(deps, u, 'google') : null;
}

export function requireCaller(deps: Deps, token: string | undefined): Caller {
  const c = currentCaller(deps, token);
  if (!c) throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
  return c;
}

export function requireRole(c: Caller, ...roles: Role[]): void {
  if (!roles.some((r) => c.roles.has(r))) throw new AppError('FORBIDDEN', 'You do not have access to this.');
}

function sixDigits(deps: Deps): string {
  const n = Number.parseInt(deps.sha256(deps.randomToken()).slice(0, 12), 16) % 1_000_000;
  return String(n).padStart(6, '0');
}

/**
 * Sends a sign-in code if the address is registered. The answer is the same either way, so the
 * screen can't be used to find out who is registered.
 */
export function requestCode(deps: Deps, rawEmail: string): { sent: true } {
  const email = rawEmail.trim().toLowerCase();
  const countKey = sendCountKey(deps, email);
  const count = Number(deps.cache.get(countKey) ?? '0');
  if (count >= CODE_MAX_SENDS_PER_HOUR) throw new AppError('RATE_LIMITED', 'Too many codes were requested for this address. Try again in an hour.');
  deps.cache.put(countKey, String(count + 1), 3600);

  const emp = findActiveUserByEmail(deps, email);
  if (!emp) {
    deps.log('info', 'Sign-in code requested for an unregistered address');
    return { sent: true };
  }
  const quota = deps.mail.remainingQuota();
  if (quota !== null && quota < 1) throw new AppError('BUSY', 'The system cannot send email right now (daily limit reached). Try again tomorrow or ask the administrator.');
  const code = sixDigits(deps);
  deps.cache.put(codeKey(deps, email), JSON.stringify({ h: deps.sha256(`${email}:${code}`), tries: 0 }), CODE_MINUTES * 60);
  deps.mail.send(
    email,
    `Your sign-in code: ${code}`,
    `Your code for DHSUD Region 10 Certificate Verification (staff) is ${code}.\n\nIt works for ${CODE_MINUTES} minutes. If you did not try to sign in, you can ignore this email.`,
  );
  return { sent: true };
}

export function verifyCode(deps: Deps, rawEmail: string, code: string): { token: string; user: User } {
  const email = rawEmail.trim().toLowerCase();
  const key = codeKey(deps, email);
  const raw = deps.cache.get(key);
  const wrong = () => new AppError('VALIDATION', 'That code is wrong or has expired. Request a new code.', { fields: { code: 'Wrong or expired code' } });
  if (!raw) throw wrong();
  const rec = JSON.parse(raw) as { h: string; tries: number };
  if (rec.h !== deps.sha256(`${email}:${code}`)) {
    rec.tries++;
    if (rec.tries >= CODE_MAX_ATTEMPTS) deps.cache.remove(key);
    else deps.cache.put(key, JSON.stringify(rec), CODE_MINUTES * 60);
    throw wrong();
  }
  deps.cache.remove(key);
  const u = findActiveUserByEmail(deps, email);
  if (!u) throw wrong();
  const token = deps.randomToken();
  deps.cache.put(sessKey(deps, token), u.userId, SESSION_HOURS * 3600);
  deps.lock.run(() => audit(deps, u.userId, u.email, 'SIGN_IN_CODE', u.userId, {}));
  return { token, user: u };
}

export function signOut(deps: Deps, token: string | undefined): void {
  if (token) deps.cache.remove(sessKey(deps, token));
}
