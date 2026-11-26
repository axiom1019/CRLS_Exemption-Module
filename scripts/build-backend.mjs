// Bundles the two Apps Script projects: dist/backend/staff/Code.js and dist/backend/verify/Code.js.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const alias = { '@shared': `${root}shared`, '@backend': `${root}backend/src` };

// Function names come from shared/apiNames.ts (type-checked against the contracts).
const src = readFileSync(`${root}shared/apiNames.ts`, 'utf8');
const listOf = (name) => {
  const block = src.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  return [...block.matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
};

const apps = [
  { name: 'staff', entry: 'backend/src/main.ts', fns: listOf('API_NAMES'), extra: ['setupDatabase'] },
  { name: 'verify', entry: 'backend/src/verifyMain.ts', fns: listOf('VERIFY_NAMES'), extra: ['connectDatabase'] },
];

for (const app of apps) {
  if (app.fns.length === 0) throw new Error(`No function names found for ${app.name}`);
  const result = await build({
    entryPoints: [`${root}${app.entry}`],
    bundle: true,
    format: 'iife',
    globalName: '__App',
    target: 'es2020',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    alias,
    write: false,
    legalComments: 'none',
  });
  const stubs = [
    '',
    '// ---- Apps Script entry points (generated) ----',
    'function doGet(e) { return __App.doGet(e); }',
    ...app.extra.map((n) => `function ${n}() { return __App.${n}(); }`),
    ...app.fns.map((n) => `function ${n}(input) { return __App.call('${n}', input); }`),
    '',
  ].join('\n');
  mkdirSync(`${root}dist/backend/${app.name}`, { recursive: true });
  writeFileSync(`${root}dist/backend/${app.name}/Code.js`, result.outputFiles[0].text + stubs);
  console.log(`${app.name}/Code.js: ${(result.outputFiles[0].contents.length / 1024).toFixed(1)} KB, ${app.fns.length} API entry points`);
}
