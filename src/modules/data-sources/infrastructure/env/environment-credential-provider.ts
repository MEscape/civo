import 'server-only';

import { serverEnv } from '@lib/config';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { credentialsMissing } from '../../domain/errors/data-source-errors';

import type { AuthMode } from '../../domain/models/data-source-kinds';
import type {
  CredentialProvider,
  CredentialResolutionError,
  ResolvedCredential,
} from '../../domain/ports/credential-provider.port';

/** A read-only view of environment variables. `serverEnv` satisfies it. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const NO_CREDENTIAL: ResolvedCredential = { mode: 'NONE' };

/**
 * Ids become part of an environment variable name. Anything outside this
 * set cannot appear in a well-formed name, so it is refused instead of
 * being looked up under a name it could not match.
 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/**
 * The variable that holds a source's credential:
 *
 *   DATASOURCE_<id>_API_KEY       DATASOURCE_<id>_BEARER_TOKEN
 *
 * Hyphens (common in cuid/uuid ids) become underscores. `null` when the id
 * cannot be mapped to a valid name.
 */
export function credentialVariableName(
  dataSourceId: string,
  authMode: Exclude<AuthMode, 'NONE'>,
): string | null {
  if (!SAFE_ID.test(dataSourceId)) {
    return null;
  }
  const suffix = authMode === 'API_KEY' ? 'API_KEY' : 'BEARER_TOKEN';
  return `DATASOURCE_${dataSourceId.replace(/-/g, '_')}_${suffix}`;
}

/**
 * Resolves credentials from server-only environment variables.
 *
 * DEVIATION (configuration.md): these variable names are per data source
 * and created at runtime, so they cannot be declared and validated at
 * startup in `@lib/config`. This is therefore the one place besides
 * `@lib/config` that reads the process environment. The clean fix is a
 * `readSecret(name)` accessor in `@lib/config`; this class takes the
 * environment as a constructor argument so only the default changes then.
 *
 * The secret is returned to the connector and nowhere else: it is never
 * logged, put into an error `cause` or into a cache key.
 */
export class EnvironmentCredentialProvider implements CredentialProvider {
  constructor(
    private readonly environment: EnvironmentSource = serverEnv as unknown as EnvironmentSource,
  ) {}

  resolve(
    input: Parameters<CredentialProvider['resolve']>[0],
  ): AppResultAsync<ResolvedCredential, CredentialResolutionError> {
    const { dataSourceId, authMode } = input;

    if (authMode === 'NONE') {
      return okAsync(NO_CREDENTIAL);
    }

    const variable = credentialVariableName(dataSourceId, authMode);
    const secret = variable === null ? undefined : this.environment[variable];
    if (!secret) {
      return errAsync(credentialsMissing());
    }

    return okAsync({ mode: authMode, secret });
  }
}
