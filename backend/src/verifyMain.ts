/* Public verify app entry (a separate, read-only Apps Script project). */
import type { VerifyName } from '@shared/api';
import { APP_NAME } from '@shared/constants';
import { verifyEndpoints } from './api/verifyEndpoints';
import { connectDatabaseByName, createGasDeps } from './platform/gas';

declare const APP_ENVIRONMENT: string | undefined;
const environment = () => (typeof APP_ENVIRONMENT === 'string' ? APP_ENVIRONMENT : 'development');

export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(`Verify a certificate | DHSUD Region 10`)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

export function call(name: VerifyName, input: unknown) {
  return verifyEndpoints[name](createGasDeps(environment(), 'verify'), input);
}

/** The owner runs this once (Run → connectDatabase) after setupDatabase in the staff app. */
export function connectDatabase(): string {
  const id = connectDatabaseByName(environment());
  const msg = `${APP_NAME}: connected to spreadsheet ${id}.`;
  console.log(msg);
  return msg;
}
