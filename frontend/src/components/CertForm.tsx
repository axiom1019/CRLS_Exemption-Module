import { CERT_TYPES, CERT_TYPE_LABELS, type CertType } from '@shared/constants';
import type { CertificateForm } from '@shared/schemas';
import { Field } from './ui';

export const emptyForm = (): CertificateForm => ({
  certType: 'LS',
  certNumber: '',
  dateIssued: '',
  transmittalNumber: '',
  transmittalDate: '',
  recipientName: '',
  recipientAddress: '',
  projectName: '',
  projectLocation: '',
  developerName: '',
  coverage: '',
  remarks: '',
});

export function CertForm(props: { value: CertificateForm; onChange: (v: CertificateForm) => void; errors: Record<string, string> }) {
  const { value: v, onChange, errors: e } = props;
  const set = <K extends keyof CertificateForm>(k: K) => (x: CertificateForm[K]) => onChange({ ...v, [k]: x });
  const input = (k: keyof CertificateForm, type = 'text', extra: Record<string, unknown> = {}) => (
    <input type={type} value={v[k]} onChange={(ev) => set(k)(ev.target.value as never)} {...extra} />
  );
  return (
    <div>
      <div className="section-title">Certificate</div>
      <div className="field" role="radiogroup" aria-label="Type">
        <span className="lbl">Type</span>
        <div className="choices three">
          {CERT_TYPES.map((t) => (
            <label key={t} className="choice">
              <input type="radio" name="certType" checked={v.certType === t} onChange={() => set('certType')(t as CertType)} />
              <span>
                <b>{t}</b>
                <small>{CERT_TYPE_LABELS[t]}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="cols-2">
        <Field label="Certificate number" error={e['form.certNumber'] ?? e.certNumber}>
          {input('certNumber', 'text', { placeholder: 'e.g. LS-R10-2026-0142', autoFocus: true })}
        </Field>
        <Field label="Date issued" error={e['form.dateIssued']}>
          {input('dateIssued', 'date')}
        </Field>
      </div>
      <div className="section-title">Transmittal</div>
      <div className="cols-2">
        <Field label="Transmittal number" hint="Optional" error={e['form.transmittalNumber']}>
          {input('transmittalNumber')}
        </Field>
        <Field label="Transmittal date" hint="Optional. The printed transmittal uses the date issued if blank." error={e['form.transmittalDate']}>
          {input('transmittalDate', 'date')}
        </Field>
      </div>
      <Field label="Addressed to" hint="Name and position, e.g. Atty. Juan Dela Cruz, Register of Deeds" error={e['form.recipientName']}>
        {input('recipientName')}
      </Field>
      <Field label="Address" hint="Office and address, one line each" error={e['form.recipientAddress']}>
        <textarea value={v.recipientAddress} onChange={(ev) => set('recipientAddress')(ev.target.value)} rows={2} />
      </Field>
      <div className="section-title">Project</div>
      <Field label="Project name" error={e['form.projectName']}>
        {input('projectName', 'text', { placeholder: 'e.g. Villa Verde Subdivision Phase 2' })}
      </Field>
      <Field label="Location" hint="Barangay, city or municipality, province" error={e['form.projectLocation']}>
        {input('projectLocation')}
      </Field>
      <Field label="Owner or developer" error={e['form.developerName']}>
        {input('developerName')}
      </Field>
      <Field label="Lots or area covered" hint="Optional, as written on the certificate, e.g. 128 lots, Blocks 1 to 9" error={e['form.coverage']}>
        {input('coverage')}
      </Field>
      <Field label="Internal remarks" hint="Staff only. Never shown on the public page." error={e['form.remarks']}>
        <textarea value={v.remarks} onChange={(ev) => set('remarks')(ev.target.value)} />
      </Field>
    </div>
  );
}
