import { publicEnvSchema, serverEnvSchema, type PublicEnv, type ServerEnv } from './env-schema';

/**
 * Parses and validates `process.env` exactly once, at import time.
 * configuration.md: "fail fast when required configuration is missing" —
 * a missing or malformed variable throws immediately on startup, not on
 * first use deep in a request handler.
 *
 * This file is the ONLY place `process.env` is read directly
 * (configuration.md: "do not access process.env throughout application
 * code"). Everything else imports `serverEnv` / `publicEnv` from
 * `@lib/config`.
 */

function formatIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
  return issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid server environment configuration:\n${formatIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

function parsePublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env['NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'],
    NEXT_PUBLIC_MAPBOX_STYLE_URL: process.env['NEXT_PUBLIC_MAPBOX_STYLE_URL'],
  });
  if (!result.success) {
    throw new Error(
      `Invalid public environment configuration:\n${formatIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

/**
 * Full server-side configuration, including secrets. Never import this
 * from a Client Component — security.md: "never expose secrets to
 * Client Components". Application/infrastructure code imports from here.
 */
export const serverEnv: ServerEnv = parseServerEnv();

/**
 * The subset of configuration safe to reach from Client Components.
 * Intentionally a separate, smaller object — importing `serverEnv` on
 * the client is a mistake this split makes structurally harder to make.
 */
export const publicEnv: PublicEnv = parsePublicEnv();
