import type { SettingsDto, UserDto } from '@shared/api';
import type { SettingsInput } from '@shared/schemas';
import type { Role } from '@shared/constants';
import type { Deps } from '../platform/types';
import { audit } from './audit';
import { requireRole, type Caller } from './auth';
import { AppError } from './errors';
import { readSettings, toUser, userDto, userRow, writeSettings } from './model';

export function listUsers(deps: Deps, caller: Caller): UserDto[] {
  requireRole(caller, 'ADMIN');
  return deps.db
    .get()
    .readAll('Users')
    .map(toUser)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName))
    .map(userDto);
}

export function saveUser(
  deps: Deps,
  caller: Caller,
  v: { userId?: string; email: string; fullName: string; position: string; roles: Role[]; isActive: boolean },
): UserDto {
  requireRole(caller, 'ADMIN');
  return deps.lock.run(() => {
    const db = deps.db.get();
    const all = db.readAll('Users').map(toUser);
    const clash = all.find((u) => u.email === v.email && u.userId !== v.userId);
    if (clash) throw new AppError('CONFLICT', 'That email is already registered.', { fields: { email: 'Already registered' } });
    const now = new Date(deps.nowMs()).toISOString();
    const owner = deps.identity.ownerEmail().toLowerCase();
    if (v.userId) {
      const u = all.find((x) => x.userId === v.userId);
      if (!u) throw new AppError('NOT_FOUND', 'That person is no longer registered.');
      if (u.email === owner && (!v.isActive || v.email !== owner)) throw new AppError('VALIDATION', 'The owner account cannot be deactivated or renamed.');
      if (u.userId === caller.user.userId && !v.roles.includes('ADMIN') && !caller.isOwner) throw new AppError('VALIDATION', 'You cannot remove your own administrator role.');
      const next = { ...u, email: v.email, fullName: v.fullName, position: v.position, roles: v.roles, isActive: v.isActive, updatedAt: now, version: u.version + 1 };
      db.replace('Users', u.userId, userRow(next));
      audit(deps, caller.user.userId, caller.email, 'SAVE_USER', u.userId, { email: v.email, roles: v.roles, isActive: v.isActive });
      return userDto(next);
    }
    const u = { userId: deps.uuid(), email: v.email, fullName: v.fullName, position: v.position, roles: v.roles, isActive: v.isActive, createdAt: now, updatedAt: now, version: 1 };
    db.append('Users', userRow(u));
    audit(deps, caller.user.userId, caller.email, 'ADD_USER', u.userId, { email: v.email, roles: v.roles });
    return userDto(u);
  });
}

export function getSettings(deps: Deps): SettingsDto {
  return readSettings(deps.db.get());
}

export function saveSettings(deps: Deps, caller: Caller, s: SettingsInput): SettingsDto {
  requireRole(caller, 'ADMIN');
  return deps.lock.run(() => {
    const db = deps.db.get();
    writeSettings(deps, db, s, caller.email);
    audit(deps, caller.user.userId, caller.email, 'SETTINGS', 'settings', s);
    return readSettings(db);
  });
}
