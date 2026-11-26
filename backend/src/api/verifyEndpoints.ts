/* Public verify API. No sign-in, read only. */
import type { ApiResult, VerifyContract, VerifyName } from '@shared/api';
import * as S from '@shared/schemas';
import type { Deps } from '../platform/types';
import * as verify from '../services/verify';
import { parse, wrap } from './wrap';

export type VerifyEndpoints = { [K in VerifyName]: (deps: Deps, input: unknown) => ApiResult<VerifyContract[K][1]> };

export const verifyEndpoints: VerifyEndpoints = {
  verify_info: wrap('verify_info', (deps) => verify.info(deps)),
  verify_lookup: wrap('verify_lookup', (deps, input) => verify.lookup(deps, parse(S.verifyLookupInput, input).code)),
  verify_document: wrap('verify_document', (deps, input) => {
    const v = parse(S.verifyDocumentInput, input);
    return verify.document(deps, v.code, v.kind);
  }),
};
