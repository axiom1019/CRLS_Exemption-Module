import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { codeFromHex, normalizeCode, formatCode, verifyUrl } from '@shared/codes';
import { base64ToBytes, sha256Hex } from '@shared/sha256';
import { endpoints } from '../api/endpoints';
import { verifyEndpoints } from '../api/verifyEndpoints';
import { PEOPLE, ok, samplePdf, seededDeps } from '../testing/fixtures';

const form = {
  certType: 'LS' as const,
  certNumber: 'LS-R10-2026-0142',
  dateIssued: '2026-11-20',
  transmittalNumber: 'TR-2026-0881',
  transmittalDate: '2026-11-21',
  projectName: 'Villa Verde Subdivision Phase 2',
  projectLocation: 'Barangay Lumbia, Cagayan de Oro City, Misamis Oriental',
  developerName: 'Northern Homes Realty Corp.',
  coverage: '128 lots',
  remarks: 'Internal note: original filed in cabinet 3',
};

function setup() {
  const deps = seededDeps();
  deps.setActiveEmail(PEOPLE.encoder);
  const created = ok(endpoints.api_createCertificate(deps, { idempotencyKey: '00000000-0000-4000-8000-000000000001', form }));
  return { deps, created };
}
const err = (r: { ok: boolean; error?: { code: string; message: string } }) => (r.ok ? null : r.error);

describe('codes', () => {
  it('makes 16-character codes and reads typed ones forgivingly', () => {
    const c = codeFromHex('0123456789abcdef0123');
    expect(c).toHaveLength(16);
    expect(normalizeCode(formatCode(c).toLowerCase())).toBe(c);
    expect(normalizeCode('0000-0000-0000-000O')).toBe('0000000000000000');
    expect(normalizeCode('IL00-0000-0000-0000')).toBe('1100000000000000');
    expect(normalizeCode('short')).toBe('');
    expect(normalizeCode('UUUU-0000-0000-0000')).toBe('');
    expect(verifyUrl('https://x.test/v', 'ABC')).toBe('https://x.test/v/ABC');
  });
  it('hashes like node crypto', () => {
    for (const s of ['', 'abc', 'x'.repeat(1000)]) {
      const b64 = Buffer.from(s).toString('base64');
      expect(sha256Hex(base64ToBytes(b64))).toBe(createHash('sha256').update(s).digest('hex'));
    }
  });
});

describe('certificate workflow', () => {
  it('creates a draft with a code and a QR address, once per idempotency key', () => {
    const { deps, created } = setup();
    expect(created.status).toBe('DRAFT');
    expect(normalizeCode(created.code)).toBe(created.code);
    expect(created.verifyUrl).toBe(`https://dhsudr10.axiomaip.com/v/${created.code}`);
    const again = ok(endpoints.api_createCertificate(deps, { idempotencyKey: '00000000-0000-4000-8000-000000000001', form }));
    expect(again.certId).toBe(created.certId);
    expect(ok(endpoints.api_listCertificates(deps, {}))).toHaveLength(1);
  });

  it('refuses a second record with the same type and number', () => {
    const { deps } = setup();
    const r = endpoints.api_createCertificate(deps, { idempotencyKey: '00000000-0000-4000-8000-000000000002', form: { ...form, certNumber: ' ls-r10-2026-0142 ' } });
    expect(err(r)?.code).toBe('CONFLICT');
    // Same number on another certificate type is fine.
    expect(endpoints.api_createCertificate(deps, { idempotencyKey: '00000000-0000-4000-8000-000000000003', form: { ...form, certType: 'CNO' } }).ok).toBe(true);
  });

  it('needs both scans before release, then shows the record publicly', () => {
    const { deps, created } = setup();
    const id = created.certId;
    expect(err(endpoints.api_release(deps, { certId: id }))?.message).toMatch(/signed certificate and the signed transmittal/);
    expect(err(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'x.jpg', base64: btoa('not a pdf') }))?.message).toMatch(/PDF/);
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'cert.pdf', base64: samplePdf('cert') }));

    // Before release the public page says only "not released".
    const draft = ok(verifyEndpoints.verify_lookup(deps, { code: created.code }));
    expect(draft).toEqual({ found: true, code: created.code, status: 'DRAFT' });
    expect(err(verifyEndpoints.verify_document(deps, { code: created.code, kind: 'CERTIFICATE' }))?.code).toBe('NOT_FOUND');

    const withT = ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'TRANSMITTAL', fileName: 'tr.pdf', base64: samplePdf('tr') }));
    expect(withT.documents.map((d) => d.kind).sort()).toEqual(['CERTIFICATE', 'TRANSMITTAL']);
    const released = ok(endpoints.api_release(deps, { certId: id }));
    expect(released.status).toBe('VALID');

    const pub = ok(verifyEndpoints.verify_lookup(deps, { code: formatCode(created.code).toLowerCase() }));
    expect(pub.status).toBe('VALID');
    expect(pub.projectName).toBe(form.projectName);
    expect(JSON.stringify(pub)).not.toContain('Internal note');
    expect(JSON.stringify(pub)).not.toContain(PEOPLE.encoder);
    expect(JSON.stringify(pub)).not.toContain('file-');
    const doc = ok(verifyEndpoints.verify_document(deps, { code: created.code, kind: 'CERTIFICATE' }));
    expect(doc.base64).toBe(samplePdf('cert'));
    expect(pub.documents?.find((d) => d.kind === 'CERTIFICATE')?.sha256).toBe(createHash('sha256').update(Buffer.from(samplePdf('cert'), 'base64')).digest('hex'));
  });

  it('locks a released record for encoders; the administrator corrects with a reason', () => {
    const { deps, created } = setup();
    const id = created.certId;
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'c.pdf', base64: samplePdf('c') }));
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'TRANSMITTAL', fileName: 't.pdf', base64: samplePdf('t') }));
    const rel = ok(endpoints.api_release(deps, { certId: id }));
    expect(err(endpoints.api_updateCertificate(deps, { certId: id, version: rel.version, form: { ...form, coverage: '130 lots' } }))?.code).toBe('FORBIDDEN');
    expect(err(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'c2.pdf', base64: samplePdf('c2') }))?.code).toBe('FORBIDDEN');
    expect(err(endpoints.api_revoke(deps, { certId: id, reason: 'x' }))?.code).toBe('FORBIDDEN');
    expect(err(endpoints.api_deleteDraft(deps, { certId: id }))?.code).toBe('CONFLICT');

    deps.setActiveEmail(PEOPLE.owner);
    expect(err(endpoints.api_updateCertificate(deps, { certId: id, version: rel.version, form: { ...form, coverage: '130 lots' } }))?.code).toBe('VALIDATION');
    const fixed = ok(endpoints.api_updateCertificate(deps, { certId: id, version: rel.version, form: { ...form, coverage: '130 lots' }, reason: 'Typo in lot count' }));
    expect(fixed.coverage).toBe('130 lots');
    expect(fixed.history.some((h) => h.action === 'CORRECT' && h.detail.includes('Typo'))).toBe(true);
    expect(err(endpoints.api_updateCertificate(deps, { certId: id, version: rel.version, form, reason: 'stale' }))?.code).toBe('STALE_VERSION');
  });

  it('shows a revoked certificate as revoked, with the reason', () => {
    const { deps, created } = setup();
    const id = created.certId;
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'c.pdf', base64: samplePdf('c') }));
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'TRANSMITTAL', fileName: 't.pdf', base64: samplePdf('t') }));
    ok(endpoints.api_release(deps, { certId: id }));
    deps.setActiveEmail(PEOPLE.owner);
    ok(endpoints.api_revoke(deps, { certId: id, reason: 'Superseded by LS-R10-2026-0150' }));
    const pub = ok(verifyEndpoints.verify_lookup(deps, { code: created.code }));
    expect(pub.status).toBe('REVOKED');
    expect(pub.revokeReason).toMatch(/Superseded/);
  });

  it('deletes a draft and its scans; the code then finds nothing', () => {
    const { deps, created } = setup();
    ok(endpoints.api_uploadDocument(deps, { certId: created.certId, kind: 'CERTIFICATE', fileName: 'c.pdf', base64: samplePdf('c') }));
    expect(deps.stored.size).toBe(1);
    ok(endpoints.api_deleteDraft(deps, { certId: created.certId }));
    expect(deps.stored.size).toBe(0);
    expect(ok(verifyEndpoints.verify_lookup(deps, { code: created.code })).found).toBe(false);
  });

  it('hides the documents when the setting is off', () => {
    const { deps, created } = setup();
    const id = created.certId;
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'CERTIFICATE', fileName: 'c.pdf', base64: samplePdf('c') }));
    ok(endpoints.api_uploadDocument(deps, { certId: id, kind: 'TRANSMITTAL', fileName: 't.pdf', base64: samplePdf('t') }));
    ok(endpoints.api_release(deps, { certId: id }));
    deps.setActiveEmail(PEOPLE.owner);
    ok(endpoints.api_saveSettings(deps, { officeName: 'DHSUD Region 10', contact: '', verifyBaseUrl: 'https://dhsudr10.axiomaip.com/v/', showDocumentsPublicly: false }));
    expect(ok(verifyEndpoints.verify_lookup(deps, { code: created.code })).documentsShown).toBe(false);
    expect(err(verifyEndpoints.verify_document(deps, { code: created.code, kind: 'CERTIFICATE' }))?.code).toBe('FORBIDDEN');
  });
});

describe('sign-in and access', () => {
  it('admits only registered, active people; personal addresses sign in with a code', () => {
    const deps = seededDeps();
    deps.setActiveEmail('stranger@dhsud.gov.ph');
    const s = ok(endpoints.api_session(deps, {}));
    expect(s.me).toBeNull();
    expect(s.denied).toBe(true);
    expect(err(endpoints.api_listCertificates(deps, {}))?.code).toBe('UNAUTHENTICATED');

    deps.setActiveEmail('');
    ok(endpoints.api_requestCode(deps, { email: PEOPLE.outside }));
    const code = deps.sent.at(-1)!.subject.match(/\d{6}/)![0];
    const { token, me } = ok(endpoints.api_verifyCode(deps, { email: PEOPLE.outside, code }));
    expect(me.user.email).toBe(PEOPLE.outside);
    expect(ok(endpoints.api_listCertificates(deps, { token }))).toEqual([]);
    expect(err(endpoints.api_listUsers(deps, { token }))?.code).toBe('FORBIDDEN');
  });
});
