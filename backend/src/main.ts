/* Staff app entry. build-backend.mjs bundles this as `__App` and adds top-level stubs
   (function doGet / function api_*) so Apps Script and google.script.run can find them. */
import type { ApiName } from '@shared/api';
import { APP_NAME } from '@shared/constants';
import { endpoints } from './api/endpoints';
import { createGasDeps, dbTitle, ensureFolder } from './platform/gas';
import { initializeDatabase } from './services/setup';

declare const APP_ENVIRONMENT: string | undefined;
const environment = () => (typeof APP_ENVIRONMENT === 'string' ? APP_ENVIRONMENT : 'development');

export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(`${APP_NAME} (Staff) | DHSUD Region 10`)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

export function call(name: ApiName, input: unknown) {
  return endpoints[name](createGasDeps(environment()), input);
}

/**
 * The owner runs this once from the Apps Script editor (Run → setupDatabase). Google asks for
 * the permissions in the manifest, then the spreadsheet, the private Drive folder and the
 * owner's administrator record are created. Running it again only adds what is missing.
 */
export function setupDatabase(): string {
  const env = environment();
  const deps = createGasDeps(env);
  const res = initializeDatabase(deps, dbTitle(env));
  ensureFolder(env);
  const msg = `${res.created ? 'Created' : 'Checked'} the database: ${res.url}\nNext: open the verify project for "${env}" and run connectDatabase.`;
  console.log(msg);
  return msg;
}
