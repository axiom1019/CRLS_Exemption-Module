import { useEffect, useState } from 'react';
import type { CertificateSummary } from '@shared/api';
import { formatCode } from '@shared/codes';
import { CERT_TYPES, CERT_TYPE_LABELS, CERT_STATUSES, STATUS_LABELS, type CertStatus, type CertType } from '@shared/constants';
import { formatLongDate } from '@shared/dates';
import { api } from '../api/client';
import { RecordModal } from '../components/RecordModal';
import { Loading, StatusPill, useLoad } from '../components/ui';

export function CertificatesPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [certType, setCertType] = useState<CertType | ''>('');
  const [status, setStatus] = useState<CertStatus | ''>('');
  const [open, setOpen] = useState<string | 'new' | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const list = useLoad<CertificateSummary[]>(
    () => api('api_listCertificates', { q: query || undefined, certType: certType || undefined, status: status || undefined }),
    [query, certType, status],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Certificates</h1>
          <p>Each record gives a QR code for the transmittal. Upload the signed scans, then release it so a scan shows it as valid.</p>
        </div>
        <button className="btn primary" onClick={() => setOpen('new')}>
          New record
        </button>
      </div>
      <div className="filters">
        <input type="text" placeholder="Search number, project, developer or code" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" style={{ flex: 1, minWidth: 240 }} />
        <select value={certType} onChange={(e) => setCertType(e.target.value as CertType | '')} aria-label="Type">
          <option value="">All types</option>
          {CERT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CERT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as CertStatus | '')} aria-label="Status">
          <option value="">Any status</option>
          {CERT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        {!list.data ? (
          <Loading error={list.error} />
        ) : list.data.length === 0 ? (
          <div className="empty">{query || certType || status ? 'No records match.' : 'No certificates recorded yet. Click New record to start.'}</div>
        ) : (
          <ul className="list">
            {list.data.map((c) => (
              <li key={c.certId}>
                <button className="row-btn" onClick={() => setOpen(c.certId)}>
                  <div>
                    <div className="title">
                      <span className={`type-tag ${c.certType}`}>{c.certType}</span> {c.certNumber}
                    </div>
                    <div className="meta">
                      {c.projectName} · {c.developerName}
                    </div>
                    <div className="meta">
                      Issued {formatLongDate(c.dateIssued)} · Code <span className="mono">{formatCode(c.code)}</span>
                    </div>
                  </div>
                  <div className="side">
                    <StatusPill status={c.status} />
                    {c.status === 'DRAFT' && (
                      <div className="meta">
                        {c.hasCertificate && c.hasTransmittal ? 'Ready to release' : `Scans: ${Number(c.hasCertificate) + Number(c.hasTransmittal)} of 2`}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && (
        <RecordModal
          certId={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
          onChanged={(id) => {
            list.reload();
            if (id) setOpen(id);
          }}
        />
      )}
    </>
  );
}
