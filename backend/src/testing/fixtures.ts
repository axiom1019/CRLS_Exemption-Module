/* Sample data for tests and the local dev bridge. */
import { endpoints } from '../api/endpoints';
import { createMemoryDeps, type MemoryDeps } from '../platform/memory';
import { initializeDatabase } from '../services/setup';

export const PEOPLE = {
  owner: 'region10@dhsud.gov.ph',
  encoder: 'licensing@dhsud.gov.ph',
  outside: 'records.clerk@gmail.com',
} as const;

export function ok<T>(r: { ok: true; data: T } | { ok: false; error: { message: string } }): T {
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}

/** Owner (administrator), a govmail encoder and an encoder with a personal address. */
export function seededDeps(opts: { nowMs?: number } = {}): MemoryDeps {
  const deps = createMemoryDeps({ ownerEmail: PEOPLE.owner, activeEmail: PEOPLE.owner, nowMs: opts.nowMs });
  initializeDatabase(deps, 'test');
  ok(endpoints.api_saveUser(deps, { email: PEOPLE.encoder, fullName: 'Maria Santos', position: 'Licensing Officer', roles: ['ENCODER'], isActive: true }));
  ok(endpoints.api_saveUser(deps, { email: PEOPLE.outside, fullName: 'Jose Ramos', position: 'Records Clerk (COS)', roles: ['ENCODER'], isActive: true }));
  return deps;
}

/** A tiny valid-looking PDF as base64. */
export function samplePdf(label: string): string {
  const body = `%PDF-1.4\n% ${label}\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n`;
  return typeof btoa === 'function' ? btoa(body) : Buffer.from(body).toString('base64');
}
