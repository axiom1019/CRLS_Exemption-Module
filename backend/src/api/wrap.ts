import type { ApiResult } from '@shared/api';
import { z } from 'zod';
import type { Deps } from '../platform/types';
import { AppError, isAppError } from '../services/errors';

export const tokenOf = (input: unknown): string | undefined => {
  const t = (input as { token?: unknown } | null)?.token;
  return typeof t === 'string' && t.length <= 200 ? t : undefined;
};

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const { token: _t, ...rest } = (input ?? {}) as Record<string, unknown>;
  const r = schema.safeParse(rest);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
    throw new AppError('VALIDATION', Object.values(fields)[0] ?? 'Check the form and try again.', { fields });
  }
  return r.data;
}

export function wrap<T>(name: string, fn: (deps: Deps, input: unknown) => T) {
  return (deps: Deps, input: unknown): ApiResult<T> => {
    const requestId = deps.uuid();
    try {
      return { ok: true, data: fn(deps, input), requestId };
    } catch (e) {
      if (isAppError(e)) return { ok: false, error: { code: e.code, message: e.message, details: e.details }, requestId };
      deps.log('error', `${name} failed`, { requestId, error: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e) });
      return { ok: false, error: { code: 'INTERNAL', message: `Something went wrong. Reference: ${requestId.slice(0, 8)}` }, requestId };
    }
  };
}
