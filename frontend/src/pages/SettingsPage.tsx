import { useEffect, useState } from 'react';
import type { AuditDto, SettingsDto } from '@shared/api';
import { api, errorText, fieldErrors } from '../api/client';
import { Field, Loading, useLoad, useToast } from '../components/ui';
import { useSession } from '../session';

export function SettingsPage() {
  const { refresh } = useSession();
  const loaded = useLoad<SettingsDto>(() => api('api_getSettings'));
  const log = useLoad<AuditDto[]>(() => api('api_audit', { limit: 200 }));
  const [v, setV] = useState<SettingsDto | null>(null);
  const [err, setErr] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => setV(loaded.data), [loaded.data]);

  const save = async () => {
    if (!v) return;
    setBusy(true);
    setErr('');
    setErrors({});
    try {
      setV(await api('api_saveSettings', v));
      toast('Settings saved.');
      refresh();
      log.reload();
    } catch (e) {
      setErr(errorText(e));
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings and log</h1>
          <p>What the public verify page shows, and every action taken in the system.</p>
        </div>
      </div>
      <div className="card card-pad">
        {!v ? (
          <Loading error={loaded.error} />
        ) : (
          <>
            {err && <div className="form-err">{err}</div>}
            <Field label="Office name" hint="Shown on the verify page." error={errors.officeName}>
              <input type="text" value={v.officeName} onChange={(e) => setV({ ...v, officeName: e.target.value })} />
            </Field>
            <Field label="Contact for questions" hint="Shown on the verify page, e.g. HREDRD's phone and email." error={errors.contact}>
              <input type="text" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} />
            </Field>
            <Field
              label="QR address"
              hint="Printed in every QR code, followed by the code. Keep it on the office's own domain, so QR codes keep working if the system moves to a server. Changing it does not change QR codes already printed."
              error={errors.verifyBaseUrl}
            >
              <input type="text" value={v.verifyBaseUrl} onChange={(e) => setV({ ...v, verifyBaseUrl: e.target.value })} />
            </Field>
            <div className="section-title">Printed transmittal</div>
            <div className="cols-2">
              <Field label="Office address" hint="Under the letterhead" error={errors.officeAddress}>
                <input type="text" value={v.officeAddress} onChange={(e) => setV({ ...v, officeAddress: e.target.value })} />
              </Field>
              <Field label="Division" hint="Shown as the preparing office" error={errors.divisionName}>
                <input type="text" value={v.divisionName} onChange={(e) => setV({ ...v, divisionName: e.target.value })} />
              </Field>
              <Field label="Signatory name" error={errors.signatoryName}>
                <input type="text" value={v.signatoryName} onChange={(e) => setV({ ...v, signatoryName: e.target.value })} />
              </Field>
              <Field label="Signatory position" error={errors.signatoryTitle}>
                <input type="text" value={v.signatoryTitle} onChange={(e) => setV({ ...v, signatoryTitle: e.target.value })} />
              </Field>
            </div>
            <div className="section-title">Public page</div>
            <label className="choice" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={v.showDocumentsPublicly} onChange={(e) => setV({ ...v, showDocumentsPublicly: e.target.checked })} />
              <span>
                Let anyone who scans the QR view and download the signed scans
                <small>When off, the verify page shows only the status and details, and asks people to contact the office for a copy.</small>
              </span>
            </label>
            <button className="btn primary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </>
        )}
      </div>
      <div className="card">
        <div className="card-pad">
          <h2>Activity log</h2>
          <p className="muted small">The latest 200 actions. Nothing in the app can edit or delete this log.</p>
        </div>
        {!log.data ? (
          <Loading error={log.error} />
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((a, i) => (
                  <tr key={i}>
                    <td className="nowrap">{a.at}</td>
                    <td>{a.actor}</td>
                    <td>{a.action}</td>
                    <td className="muted small" style={{ wordBreak: 'break-word', maxWidth: 420 }}>
                      {a.detail === '{}' ? '' : a.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
