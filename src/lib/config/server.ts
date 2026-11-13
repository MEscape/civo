import 'server-only';

import { serverEnvSchema, type ServerEnv } from './env-schema';
import { parseEnv } from './parse-env';

/**
 * Full server-side configuration, including secrets, validated once when the
 * first server module imports it (configuration.md: fail fast).
 *
 * This is the ONLY place `process.env` is read as a whole
 * (configuration.md: "do not access process.env throughout application
 * code"). `server-only` turns an import from a Client Component into a build
 * error instead of a runtime validation failure against the browser's empty
 * `process.env`.
 */
export const serverEnv: ServerEnv = parseEnv('server', serverEnvSchema, process.env);

/** Runtime-created credential names cannot be declared in the startup schema. Trusted server adapters only. */
export function readServerSecret(name: string): string | undefined {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? process.env[name] : undefined;
}

export type { ServerEnv } from './env-schema';
export type { MailEnv } from './mail-env-schema';
export type { StorageEnv } from './storage-env-schema';
export { resolveRateLimitSettings } from './rate-limit-settings';
export type { ClientAddressSettings, RateLimitSettings } from './rate-limit-settings';
