# CRLS Exemption Module: Certificate Verification (QR)

DHSUD Region 10. Every transmittal for a **License to Sell (LS)**, **Exemption to License to Sell (ELS)** or **Certificate of No Objection (CNO)** carries a QR code. Scanning it opens the office's own record: the certificate's status (valid, revoked or not yet released), its details, and the signed scans of the certificate and transmittal as issued.

> **Small-scale build.** This version runs on Google Apps Script, Google Sheets and Google Drive in the office Google Workspace, so it needs no server. It suits one regional office. Move it to an office server (bare-metal) or a VPS before other regions use it or it is joined with other DHSUD systems. See [Scale limits and server migration](#scale-limits-and-server-migration).

Proposal: *QR Certificate Verification: Project Proposal* (Claude Doc shared with the project).

## How it works

1. **Encode.** HREDRD (Housing and Real Estate Development Regulation Division) staff sign in and record the certificate: type, number, date issued, transmittal number, date and addressee, project, location, owner or developer, lots covered. It is saved as a draft.
2. **Print the transmittal.** The record gets a random 16-character verification code (`XXXX-XXXX-XXXX-XXXX`). **Print transmittal with QR** prints the transmittal letter on the DHSUD letterhead with the QR code and code in a verification box at the bottom (the letter text can be adjusted before printing; signatory and office address are in Settings). For a transmittal made outside the app, **Download label (PNG)** gives a QR label to insert (about 6 cm wide).
3. **Sign and scan.** The documents are signed as usual, then the signed certificate and signed transmittal are scanned to PDF (200 to 300 dpi, up to 10 MB each) and uploaded. Each file's SHA-256 fingerprint is kept with the record.
4. **Release.** With both scans in, staff click **Release**. A scan now shows the certificate as **Genuine and valid**. Before release it shows **Not yet released**.
5. **Verify.** Anyone scans the QR (or types the code on the verify page). No sign-in. The page shows the status, the details, and (if the setting is on) lets them view and download the signed scans. Someone who was sent a PDF can check it against the original on their own device: any change to the file makes it not match.

The administrator can **revoke** a released certificate with a reason (shown on the public page in red), **correct** a released record's details or **replace** a scan with a reason, and manage people and settings. Encoders can edit and delete only drafts. Every action goes to an append-only log.

### What the public page shows

Only what the paper certificate shows: type, number, dates, transmittal, project, location, owner or developer, lots covered, and the status. Never the internal remarks, staff names or Drive file IDs. A draft shows only "not yet released".

## Design

- **The QR points to the office's own address**, `https://dhsudr10.axiomaip.com/v/<code>`, which the landing page (Vercel) forwards to the verify app. Printed QR codes keep working when the system moves to a server; only the forwarding changes. The address is a setting (Settings and log → QR address).
- **Two Apps Script projects, one database.** The **staff** app (Google sign-in, read and write) and the **verify** app (no sign-in, read only) are separate deployments that share one spreadsheet and one restricted Drive folder. The verify project's manifest asks only for read-only Sheets and Drive scopes, so it cannot change a record even if its code had a bug.
- **Random codes.** 80 random bits, Crockford base32 (no I, L, O or U; typed O reads as 0 and I or L as 1). Nobody can guess codes or list certificates by counting.
- **Same pattern as the leave application.** Business rules in `backend/src/services/` use only the interfaces in `backend/src/platform/types.ts`. `platform/gas.ts` is the only Google-specific code.

## Sign-in (staff)

Only addresses the administrator registers (People) can sign in. dhsud.gov.ph accounts signed in to Google go straight in. Others enter their registered address and get a 6-digit code by email (10 minutes, 5 tries, 5 codes an hour). A session lasts up to 6 hours. This is the same as the leave application, for the same reason: Google tells an app that runs as the owner only the email of users in the same Workspace domain.

## Project layout

```
backend/src/
  api/endpoints.ts         staff api_* functions: parse input → caller → service
  api/verifyEndpoints.ts   public verify_* functions (read only)
  services/                certificates (workflow), verify (public lookup), users and settings, auth, audit
  platform/                gas.ts (Sheets, Drive, Mail, Cache, Lock), memory.ts (tests, dev), types.ts
  repository/schema.ts     sheet and column definitions
  main.ts, verifyMain.ts   doGet + setup for each Apps Script project
backend/appsscript.json         staff manifest (access: anyone with a Google account)
backend/appsscript.verify.json  verify manifest (access: anyone, no sign-in; read-only scopes)
shared/                    types, validation (zod), codes, dates, privacy notice
frontend/index.html        staff app → frontend/src/App.tsx
frontend/verify.html       public page → frontend/src/verify/VerifyApp.tsx
scripts/                   build, assemble and deploy with clasp
```

## Develop

```
npm install
npm run dev     # staff:  http://localhost:5175/?as=encoder   (also owner, outside, stranger)
                # public: http://localhost:5175/verify.html?c=sample-valid   (also sample-revoked, sample-draft)
npm test        # workflow, permissions, public output, codes, hashing
npm run typecheck
```

`npm run dev` runs the real backend code in the browser on sample data. Nothing is saved, and each page has its own sample data.

## Deploy

Prerequisites: Node.js 22, and `@google/clasp` signed in as the owner account (for example region10@dhsud.gov.ph) with the Apps Script API enabled at https://script.google.com/home/usersettings.

First time, for each environment (staging first):

1. Create both projects and commit their `.clasp.json` files (they hold only script IDs):
   ```
   cd deploy/staging/staff  && clasp create-script --type standalone --title "certificate-verification-staff-staging"  --rootDir build
   cd ../verify             && clasp create-script --type standalone --title "certificate-verification-verify-staging" --rootDir build
   ```
2. From the repo root: `npm run deploy:staging`. It builds, pushes both projects, creates both deployments and prints their URLs.
3. In the **staff** project, run `setupDatabase` once and approve the permissions. It creates the spreadsheet "Certificate Verification DB (staging)", the restricted Drive folder, and registers the owner as administrator.
4. In the **verify** project, run `connectDatabase` once and approve the (read-only) permissions. It finds that spreadsheet by name.
5. Point the QR address at the verify app. In the landing page repo's `vercel.json`, add (with the verify deployment ID):
   ```json
   "redirects": [
     { "source": "/v/:code", "destination": "https://script.google.com/macros/s/<VERIFY_DEPLOYMENT_ID>/exec?c=:code", "permanent": false },
     { "source": "/v", "destination": "https://script.google.com/macros/s/<VERIFY_DEPLOYMENT_ID>/exec", "permanent": false }
   ]
   ```
   For staging, use a separate path (for example `/v-test/`) and set Settings → QR address to match, so test QR codes never point at production.
6. Open the staff URL as the owner, set the office contact (Settings and log), and register the licensing staff (People).

The deployment IDs stay the same across later `npm run deploy:*` runs, so the forwarding never needs changing.

Production: `CONFIRM_PRODUCTION=yes npm run deploy:production`. It is refused until the DPO approves the privacy notice and `approved` is set to `true` in `shared/privacy.ts`.

### Check on staging before go-live

- A registered govmail account goes straight in; an unregistered one is refused; a personal Gmail account gets in only with a code.
- The verify page opens with no Google sign-in, in a private window, on Android and iPhone. If Google asks for a sign-in, the Workspace admin has blocked "Anyone" web apps for dhsud.gov.ph (Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings); ask DICT/IT to allow it for the owner account.
- A printed transmittal and label scan from about 30 cm with a phone camera, on plain and on photocopied paper.
- View and Download of the scans work on a phone. (Apps Script serves pages inside a frame; if a phone blocks opening the PDF in a new tab, Download still works.)

## Scale limits and server migration

Approximate Google limits for Workspace accounts (Google can change them): 6 minutes per run, about 30 runs at once per user, 10 million cells per spreadsheet, about 10 MB per scan through the web app, and no uptime guarantee for Apps Script. The public page carries Google's notice that it was made with Apps Script. Every scan is one Apps Script run, so a burst of scans can be slow.

**Move to a server** when other regions or the central office will use it, when it is joined with document routing or a licensing system, when scans reach thousands a day, or when the limits above cause failures. The move keeps `services/` and `shared/`, replaces `platform/gas.ts` with a database, file storage and SMTP mail, imports the Sheets rows and Drive files (the stored fingerprints prove the files were not changed in the move), and repoints the `/v/` forwarding. QR codes already printed keep working.
