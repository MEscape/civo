import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { DataSource } from '../models/data-source';

/**
 * Failures the port may report. Validation errors mean the SAVED
 * configuration cannot be used (`connectorUnavailable`, `credentialsMissing`,
 * `addressNotAllowed`, or a stored config that no longer parses);
 * infrastructure errors mean the external system could not be reached or
 * answered badly (`connectionFailed`, `connectionTimedOut`,
 * `authenticationFailed`, `upstreamError`, `responseTooLarge`,
 * `responseUnreadable`, `responseNotJson`).
 */
export type ConnectorError = ValidationAppError | InfrastructureAppError;

/**
 * The only way the application reaches an external system. The domain
 * decides WHAT to do with a response (`discoverFromBody`, `mapRecords`);
 * this port only produces the parsed body, so it knows nothing about
 * mappings or canonical kinds.
 *
 * Callers authorize first; the connector does not know the actor. Every
 * call re-parses the stored config and re-applies the outbound policy
 * (`parseRestConnectionConfig`, `checkOutboundUrl`, and `isPublicAddress`
 * on the resolved IP), so configuration saved before a rule existed is
 * checked again. Credentials come from a `CredentialProvider`.
 *
 * Implementations bound every call (timeout, maximum response size) and
 * translate each failure into our own error kinds. Upstream details (HTTP
 * status, response text) are logged, never returned. A kind without a
 * connector, such as MOCK, yields `connectorUnavailable()`.
 */
export interface DataSourceConnector {
  /** Checks reachability, authentication and that the response is readable JSON. */
  test(source: DataSource): AppResultAsync<void, ConnectorError>;

  /** The parsed JSON body of the source's configured endpoint, unmapped. */
  fetchBody(source: DataSource): AppResultAsync<unknown, ConnectorError>;
}
