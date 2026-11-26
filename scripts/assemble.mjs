// Copies the built page + backend + manifest into deploy/<env>/<app>/build for clasp push.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [env, app] = process.argv.slice(2);
if (!['staging', 'production'].includes(env) || !['staff', 'verify'].includes(app)) throw new Error('Usage: assemble.mjs staging|production staff|verify');

const root = fileURLToPath(new URL('..', import.meta.url));
const page = app === 'staff' ? 'dist/frontend-index/index.html' : 'dist/frontend-verify/verify.html';
const code = `dist/backend/${app}/Code.js`;
const manifest = app === 'staff' ? 'backend/appsscript.json' : 'backend/appsscript.verify.json';
for (const f of [page, code]) if (!existsSync(`${root}${f}`)) throw new Error(`Missing ${f}. Run npm run build first.`);
const out = `${root}deploy/${env}/${app}/build`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(`${root}${page}`, `${out}/index.html`);
cpSync(`${root}${code}`, `${out}/Code.js`);
cpSync(`${root}${manifest}`, `${out}/appsscript.json`);
writeFileSync(`${out}/Env.js`, `var APP_ENVIRONMENT = ${JSON.stringify(env)};\n`);
console.log(`Assembled ${env}/${app} → deploy/${env}/${app}/build`);
