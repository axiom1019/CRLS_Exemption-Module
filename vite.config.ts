import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
/** Which page to build: 'index' (staff app) or 'verify' (public page). Dev serves both. */
const entry = process.env.APP_ENTRY === 'verify' ? 'verify' : 'index';

export default defineConfig({
  root: r('./frontend'),
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@shared': r('./shared'), '@backend': r('./backend/src') } },
  build: {
    outDir: r(`./dist/frontend-${entry}`),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: r(`./frontend/${entry}.html`) },
  },
  server: { port: 5175, strictPort: true },
});
