import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AuthMode } from '../models/data-source-kinds';
import type { DataSourceId } from '../models/ids';

/**
 * What a request to the external system must carry. `NONE` has no secret,
 * so there is nothing to leak for an unauthenticated source.
 */
export type ResolvedCredential =
  { readonly mode: 'NONE' } | { readonly mode: Exclude<AuthMode, 'NONE'>; readonly secret: string };

/**
 * Failures the port may report. A missing secret is a configuration problem
 * the administrator can act on (`credentialsMissing()`, a validation error);
 * a failing secret store is infrastructure.
 */
export type CredentialResolutionError = ValidationAppError | InfrastructureAppError;

/**
 * Resolves the secret of a source from server-only configuration at request
 * time. Only the auth MODE is ever stored with the source; the secret
 * returned here exists in memory for the duration of one outbound request.
 *
 * It must never reach a view, an audit event, a log line, an error `cause`
 * or a cache key. Only the connector adapter should hold a
 * `ResolvedCredential`.
 */
export interface CredentialProvider {
  resolve(input: {
    readonly tenantId: TenantId;
    readonly dataSourceId: DataSourceId;
    readonly authMode: AuthMode;
  }): AppResultAsync<ResolvedCredential, CredentialResolutionError>;
}
