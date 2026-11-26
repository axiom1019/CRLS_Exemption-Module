import { useState } from 'react';
import type { UserDto } from '@shared/api';
import { ROLES, ROLE_LABELS, type Role } from '@shared/constants';
import { api, errorText, fieldErrors } from '../api/client';
import { Field, Loading, Modal, useLoad, useToast } from '../components/ui';

type Draft = { userId?: string; email: string; fullName: string; position: string; roles: Role[]; isActive: boolean };

export function PeoplePage() {
  const list = useLoad<UserDto[]>(() => api('api_listUsers'));
  const [edit, setEdit] = useState<Draft | null>(null);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>Only the people listed here can sign in. dhsud.gov.ph accounts go straight in; others get a code by email.</p>
        </div>
        <button className="btn primary" onClick={() => setEdit({ email: '', fullName: '', position: '', roles: ['ENCODER'], isActive: true })}>
          Add person
        </button>
      </div>
      <div className="card table-wrap">
        {!list.data ? (
          <Loading error={list.error} />
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <b>{u.fullName}</b>
                    <div className="muted small">{u.position}</div>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.roles.map((r) => ROLE_LABELS[r]).join(', ') || '—'}</td>
                  <td>{u.isActive ? 'Active' : <span className="muted">Inactive</span>}</td>
                  <td>
                    <button className="btn small-btn" onClick={() => setEdit({ ...u })}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && <PersonModal value={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), list.reload())} />}
    </>
  );
}

function PersonModal(props: { value: Draft; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(props.value);
  const [err, setErr] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api('api_saveUser', v);
      toast('Saved.');
      props.onSaved();
    } catch (e) {
      setErr(errorText(e));
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={v.userId ? 'Edit person' : 'Add person'}
      onClose={props.onClose}
      narrow
      footer={
        <>
          <button className="btn" onClick={props.onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {err && <div className="form-err">{err}</div>}
      <Field label="Full name" error={errors.fullName}>
        <input type="text" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoFocus />
      </Field>
      <Field label="Email" hint="Their dhsud.gov.ph address, or a personal address for staff without govmail." error={errors.email}>
        <input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </Field>
      <Field label="Position" error={errors.position}>
        <input type="text" value={v.position} onChange={(e) => setV({ ...v, position: e.target.value })} />
      </Field>
      <Field label="Role">
        <div className="choices">
          {ROLES.map((r) => (
            <label key={r} className="choice">
              <input type="checkbox" checked={v.roles.includes(r)} onChange={(e) => setV({ ...v, roles: e.target.checked ? [...v.roles, r] : v.roles.filter((x) => x !== r) })} />
              <span>
                {ROLE_LABELS[r]}
                <small>{r === 'ENCODER' ? 'HREDRD staff: records certificates, prints transmittals with QR, uploads scans, releases' : 'Also manages people and settings, corrects released records and revokes'}</small>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <label className="choice">
        <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
        <span>Active (can sign in)</span>
      </label>
    </Modal>
  );
}
