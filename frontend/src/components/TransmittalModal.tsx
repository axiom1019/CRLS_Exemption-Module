import { useMemo, useState } from 'react';
import type { CertificateDto } from '@shared/api';
import { useSession } from '../session';
import { printHtml } from './print';
import { defaultBody, transmittalHtml } from './transmittal';
import { Field, Modal } from './ui';

export function TransmittalModal({ cert, onClose }: { cert: CertificateDto; onClose: () => void }) {
  const { settings } = useSession();
  const [body, setBody] = useState(() => defaultBody(cert, settings));
  const html = useMemo(() => transmittalHtml(cert, settings, body), [cert, settings, body]);
  const missing = [!cert.recipientName && 'who it is addressed to (Edit details)', !settings.signatoryName && 'the signatory (Settings and log)'].filter(Boolean);
  return (
    <Modal
      title="Print transmittal"
      subtitle="The QR code is printed on the transmittal. After it is signed, scan it and upload it as the signed transmittal."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button className="btn primary" onClick={() => printHtml(html)}>
            Print (or save as PDF)
          </button>
        </>
      }
    >
      {missing.length > 0 && <div className="notice">Not filled in yet: {missing.join(' and ')}. You can still print and write it in by hand.</div>}
      <Field label="Letter text" hint="Change the wording for this transmittal if needed. Blank line = new paragraph. This text is not saved.">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} />
      </Field>
      <div className="section-title">Preview</div>
      <iframe className="tx-preview" title="Transmittal preview" srcDoc={html} />
    </Modal>
  );
}
