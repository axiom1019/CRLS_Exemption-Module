import type { Deps } from '../platform/types';
import { audit } from './audit';
import { readSettings, toUser, userRow, writeSettings } from './model';

/**
 * Creates the spreadsheet and its sheets (or adds what is missing), saves default settings and
 * registers the owner account as administrator so they can register everyone else. Safe to run again.
 */
export function initializeDatabase(deps: Deps, title: string): { url: string; created: boolean } {
  const res = deps.db.ensureSchema(title);
  deps.lock.run(() => {
    const db = deps.db.get();
    if (!db.readAll('Settings').length) writeSettings(deps, db, readSettings(db), 'setup');
    const owner = deps.identity.ownerEmail().toLowerCase();
    if (owner && !db.readAll('Users').some((r) => toUser(r).email === owner)) {
      const now = new Date(deps.nowMs()).toISOString();
      const id = deps.uuid();
      db.append('Users', userRow({ userId: id, email: owner, fullName: 'System Administrator', position: '', roles: ['ADMIN', 'ENCODER'], isActive: true, createdAt: now, updatedAt: now, version: 1 }));
      audit(deps, id, owner, 'SETUP', 'database', { created: res.created });
    }
  });
  return res;
}
