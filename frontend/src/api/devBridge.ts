/**
 * LOCAL DEVELOPMENT ONLY (left out of production builds).
 * Runs the real backend endpoints in the browser on an in-memory database with sample records.
 * Staff page: ?as=owner|encoder|outside|stranger. Verify page: ?c=sample-valid|sample-revoked|sample-draft
 * (or any real code shown in the staff page's console). Data resets on reload.
 */
import type { ApiResult } from '@shared/api';
import { endpoints } from '@backend/api/endpoints';
import { verifyEndpoints } from '@backend/api/verifyEndpoints';
import { PEOPLE, ok, samplePdf, seededDeps } from '@backend/testing/fixtures';

const params = new URLSearchParams(location.search);
const who = params.get('as') ?? 'encoder';
const deps = seededDeps({ nowMs: Date.now() });

function record(n: number, certType: 'LS' | 'ELS' | 'CNO', certNumber: string, projectName: string, developerName: string, location: string, coverage: string, release: boolean) {
  const c = ok(
    endpoints.api_createCertificate(deps, {
      idempotencyKey: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      form: { certType, certNumber, dateIssued: '2026-11-1' + n, transmittalNumber: `TR-2026-08${70 + n}`, transmittalDate: '2026-11-1' + n, recipientName: 'The Register of Deeds', recipientAddress: 'Registry of Deeds of Cagayan de Oro City\nHall of Justice, Hayes Street, Cagayan de Oro City', projectName, projectLocation: location, developerName, coverage, remarks: '' },
    }),
  );
  if (release) {
    ok(endpoints.api_uploadDocument(deps, { certId: c.certId, kind: 'CERTIFICATE', fileName: 'scan-certificate.pdf', base64: samplePdf(`certificate ${certNumber}`) }));
    ok(endpoints.api_uploadDocument(deps, { certId: c.certId, kind: 'TRANSMITTAL', fileName: 'scan-transmittal.pdf', base64: samplePdf(`transmittal ${certNumber}`) }));
    ok(endpoints.api_release(deps, { certId: c.certId }));
  }
  return c;
}

deps.setActiveEmail(PEOPLE.encoder);
const valid = record(1, 'LS', 'LS-R10-2026-0142', 'Villa Verde Subdivision Phase 2', 'Northern Homes Realty Corp.', 'Barangay Lumbia, Cagayan de Oro City, Misamis Oriental', '128 lots, Blocks 1 to 9', true);
const revoked = record(2, 'CNO', 'CNO-R10-2026-0037', 'Camella Heights Annex', 'Riverbend Land Inc.', 'Barangay Bulua, Cagayan de Oro City', '46 lots', true);
record(3, 'ELS', 'ELS-R10-2026-0019', 'Bayanihan Homes', 'Kauswagan Housing Cooperative', 'Barangay Kauswagan, Cagayan de Oro City', '24 lots', true);
const draft = record(4, 'LS', 'LS-R10-2026-0151', 'Sunrise Ridge Phase 1', 'Opol Estates Development Corp.', 'Barangay Taboc, Opol, Misamis Oriental', '210 lots', false);
deps.setActiveEmail(PEOPLE.owner);
ok(endpoints.api_revoke(deps, { certId: revoked.certId, reason: 'Superseded by CNO-R10-2026-0041 after a change in the lot plan.' }));
ok(endpoints.api_saveSettings(deps, { officeName: 'DHSUD Regional Office X, Cagayan de Oro City', contact: 'HREDRD, (088) 000-0000, region10@dhsud.gov.ph', verifyBaseUrl: 'https://dhsudr10.axiomaip.com/v/', showDocumentsPublicly: true, officeAddress: 'Cagayan de Oro City', divisionName: 'Housing and Real Estate Development Regulation Division', signatoryName: 'Juan A. Dela Cruz', signatoryTitle: 'Regional Director' }));

const samples: Record<string, string> = { 'sample-valid': valid.code, 'sample-revoked': revoked.code, 'sample-draft': draft.code };
console.info('[dev] sample codes', samples);

const emails: Record<string, string> = { ...PEOPLE, stranger: 'stranger@dhsud.gov.ph' };
// The outside encoder has a personal address, so Google does not share it: they sign in with a code.
deps.setActiveEmail(who === 'outside' ? '' : (emails[who] ?? ''));
const send = deps.mail.send;
deps.mail.send = (to, subject, body) => {
  console.info(`[dev] email to ${to}: ${subject}`);
  send(to, subject, body);
};

const all: Record<string, (d: typeof deps, input: unknown) => ApiResult<unknown>> = { ...endpoints, ...verifyEndpoints };

export async function devTransport(name: string, input: unknown): Promise<ApiResult<unknown>> {
  await new Promise((r) => setTimeout(r, 120));
  let i = structuredClone(input) as Record<string, unknown>;
  if (typeof i?.code === 'string' && samples[i.code]) i = { ...i, code: samples[i.code] };
  if (name.startsWith('verify_')) deps.setActiveEmail('');
  const fn = all[name];
  if (!fn) throw new Error(`Unknown function ${name}`);
  return structuredClone(fn(deps, i));
}
