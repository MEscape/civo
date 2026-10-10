import type { ZodType } from 'zod';

/**
 * Validates `source` against `schema` or throws one error naming every bad
 * variable. configuration.md: "fail fast when required configuration is
 * missing" — callers run this at import time, so a bad variable stops startup
 * rather than failing deep in a request.
 */
export function parseEnv<T>(label: 'server' | 'public', schema: ZodType<T>, source: unknown): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid ${label} environment configuration:\n${issues}`);
  }
  return result.data;
}
