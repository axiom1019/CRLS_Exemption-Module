/**
 * Notice shown on the public verify page (RA 10173, Data Privacy Act).
 * DRAFT: the DPO must approve the wording. Set `approved: true` only after written approval;
 * scripts/deploy.mjs refuses to deploy production until then.
 */
export const PRIVACY_NOTICE = {
  version: 'draft-2026-11-26',
  approved: false,
  text: [
    'This page lets anyone holding a certificate issued by DHSUD Region 10 confirm that it is genuine. It shows only what the certificate itself shows: its type and number, dates, the project, its location, the owner or developer and the lots covered.',
    'DHSUD does not record who scans a code. Records are kept in the office Google Workspace account and retained according to the National Archives schedule.',
    'Questions about this record or about your personal information: contact the office or its Data Protection Officer.',
  ].join('\n\n'),
};
