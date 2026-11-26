import { useEffect, useState } from 'react';
import type { VerifyInfo, VerifyResult } from '@shared/api';
import { formatCode, normalizeCode } from '@shared/codes';
import { STATUS_LABELS, type DocKind } from '@shared/constants';
import { formatLongDate, manilaDate } from '@shared/dates';
import { errorText, pageParameters, verifyApi } from '../api/client';
import seal from '../assets/seal.png';
import { formatBytes, openBase64Pdf, sha256OfFile } from '../components/files';

export function VerifyApp() {
  const [info, setInfo] = useState<VerifyInfo | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const lookup = async (code: string) => {
    setBusy(true);
    setErr('');
    try {
      setResult(await verifyApi('verify_lookup', { code }));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void verifyApi('verify_info').then(setInfo, (e: unknown) => setErr(errorText(e)));
    void pageParameters().then((p) => {
      const c = p.c ?? p.code ?? '';
      if (c) {
        setTyped(c.startsWith('sample-') ? c : formatCode(c));
        void lookup(c);
      }
    });
  }, []);

  return (
    <div className="vp">
      {info && info.environment !== 'production' && <div className="env">{info.environment.toUpperCase()}: test copy. Results here are not official.</div>}
      <header className="vp-mast">
        <div className="vp-wrap">
          <img src={seal} alt="DHSUD seal" />
          <div className="vp-id">
            <small>Republic of the Philippines</small>
            <strong>Department of Human Settlements and Urban Development</strong>
            <em>Region 10 · Certificate Verification</em>
          </div>
        </div>
      </header>
      <div className="vp-band" />
      <main className="vp-wrap vp-main">
        {result ? (
          <ResultView result={result} info={info} onAnother={() => (setResult(null), setTyped(''))} />
        ) : (
          <section className="card card-pad vp-form">
            <h1>Check a certificate</h1>
            <p className="muted">Scan the QR code on the transmittal with your phone camera, or type the 16-character verification code printed beside it.</p>
            {err && <div className="form-err">{err}</div>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!normalizeCode(typed) && !typed.startsWith('sample-')) {
                  setErr('A code has 16 letters and numbers, like 7KQ4-M9XD-2HPA-R10C.');
                  return;
                }
                void lookup(typed);
              }}
            >
              <label className="field">
                <span className="lbl">Verification code</span>
                <input type="text" className="code-field" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
              </label>
              <button className="btn primary block" disabled={busy || !typed.trim()}>
                {busy ? 'Checking…' : 'Check'}
              </button>
            </form>
          </section>
        )}
        <Footer info={info} />
      </main>
    </div>
  );
}

function ResultView({ result: r, info, onAnother }: { result: VerifyResult; info: VerifyInfo | null; onAnother: () => void }) {
  if (!r.found) {
    return (
      <section className="card vp-result">
        <div className="vp-status bad">
          <span className="vp-icon" aria-hidden="true">
            ✕
          </span>
          <div>
            <div className="vp-k">No record found</div>
            <h1>This code is not in the DHSUD Region 10 records</h1>
          </div>
        </div>
        <div className="card-pad">
          <p>Check that the code was typed correctly. If it was scanned from a QR code and still shows this, the document may not be genuine. Contact the office before relying on it.</p>
          <Contact info={info} />
          <button className="btn" style={{ marginTop: 14 }} onClick={onAnother}>
            Check another code
          </button>
        </div>
      </section>
    );
  }
  if (r.status === 'DRAFT') {
    return (
      <section className="card vp-result">
        <div className="vp-status wait">
          <span className="vp-icon" aria-hidden="true">
            …
          </span>
          <div>
            <div className="vp-k">Not yet released</div>
            <h1>This certificate is still being processed</h1>
          </div>
        </div>
        <div className="card-pad">
          <p>The office has recorded this code, but the signed certificate has not been released yet. Do not rely on a paper copy until this page shows it as valid.</p>
          <Contact info={info} />
        </div>
      </section>
    );
  }
  const valid = r.status === 'VALID';
  return (
    <section className="card vp-result">
      <div className={`vp-status ${valid ? 'ok' : 'bad'}`}>
        <span className="vp-icon" aria-hidden="true">
          {valid ? '✓' : '!'}
        </span>
        <div>
          <div className="vp-k">{valid ? 'Genuine and valid' : STATUS_LABELS.REVOKED}</div>
          <h1>
            {r.certTypeLabel} No. {r.certNumber}
          </h1>
        </div>
      </div>
      {!valid && (
        <div className="vp-revoked">
          <b>This certificate was revoked{r.revokedAt ? ` on ${formatLongDate(manilaDate(Date.parse(r.revokedAt)))}` : ''}.</b> {r.revokeReason}
        </div>
      )}
      <div className="card-pad">
        <p className="muted small">Issued by {info?.officeName ?? 'DHSUD Region 10'}. Compare these details with the paper you hold. They must match exactly.</p>
        <dl className="kv vp-kv">
          <dt>Certificate</dt>
          <dd>{r.certTypeLabel}</dd>
          <dt>Number</dt>
          <dd>
            <b>{r.certNumber}</b>
          </dd>
          <dt>Date issued</dt>
          <dd>{r.dateIssued && formatLongDate(r.dateIssued)}</dd>
          {(r.transmittalNumber || r.transmittalDate) && (
            <>
              <dt>Transmittal</dt>
              <dd>{[r.transmittalNumber, r.transmittalDate && formatLongDate(r.transmittalDate)].filter(Boolean).join(', ')}</dd>
            </>
          )}
          <dt>Project</dt>
          <dd>{r.projectName}</dd>
          <dt>Location</dt>
          <dd>{r.projectLocation}</dd>
          <dt>Owner or developer</dt>
          <dd>{r.developerName}</dd>
          {r.coverage && (
            <>
              <dt>Lots or area covered</dt>
              <dd>{r.coverage}</dd>
            </>
          )}
          <dt>Verification code</dt>
          <dd className="mono">{formatCode(r.code)}</dd>
        </dl>
        <Documents r={r} />
        <Contact info={info} />
        <button className="btn" style={{ marginTop: 14 }} onClick={onAnother}>
          Check another code
        </button>
      </div>
    </section>
  );
}

function Documents({ r }: { r: VerifyResult }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [check, setCheck] = useState<{ name: string; match: string | null } | null>(null);
  const docs = r.documents ?? [];
  const open = async (kind: DocKind, mode: 'open' | 'download') => {
    setBusy(kind + mode);
    setErr('');
    try {
      const f = await verifyApi('verify_document', { code: r.code, kind });
      openBase64Pdf(f.base64, f.fileName, mode);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy('');
    }
  };
  const compare = async (file: File) => {
    const h = await sha256OfFile(file);
    const hit = docs.find((d) => d.sha256 === h);
    setCheck({ name: file.name, match: hit ? hit.label : null });
  };
  return (
    <div className="vp-docs">
      <h2>The issued certificate and its transmittal</h2>
      {err && <div className="form-err">{err}</div>}
      {r.documentsShown ? (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.kind}>
              <div>
                <b>{d.label}</b>
                <div className="meta">PDF · {formatBytes(d.sizeBytes)}</div>
              </div>
              <div className="actions">
                <button className="btn small-btn" disabled={!!busy} onClick={() => void open(d.kind, 'open')}>
                  {busy === d.kind + 'open' ? 'Opening…' : 'View'}
                </button>
                <button className="btn small-btn" disabled={!!busy} onClick={() => void open(d.kind, 'download')}>
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">The office keeps the signed originals. Contact the office for a certified copy.</p>
      )}
      <details className="vp-check">
        <summary>Received a PDF copy? Check that it is the original file</summary>
        <p className="muted small">Choose the PDF. It is checked on your device and is not uploaded. Any change to the file, even one character, makes it not match.</p>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => e.target.files?.[0] && void compare(e.target.files[0])} />
        {check &&
          (check.match ? (
            <div className="notice ok" style={{ marginTop: 10 }}>
              <b>{check.name}</b> matches the {check.match.toLowerCase()} on file exactly.
            </div>
          ) : (
            <div className="notice bad" style={{ marginTop: 10 }}>
              <b>{check.name}</b> does not match the files on file. It may be a different scan or an altered copy. Use the documents above, or contact the office.
            </div>
          ))}
      </details>
    </div>
  );
}

function Contact({ info }: { info: VerifyInfo | null }) {
  if (!info?.contact) return null;
  return (
    <p className="small" style={{ marginTop: 14 }}>
      <b>Questions?</b> {info.contact}
    </p>
  );
}

function Footer({ info }: { info: VerifyInfo | null }) {
  return (
    <footer className="vp-foot">
      {info && (
        <details>
          <summary>Privacy notice</summary>
          {info.privacy.text.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>
      )}
      <p>A verification service of {info?.officeName ?? 'DHSUD Region 10'}. This page is the only official way to verify by QR code; DHSUD never asks for payment to verify a certificate.</p>
    </footer>
  );
}
