import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { DATA_SOURCE_RATE_LIMITS } from '../rate-limits';
import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';
import { withinActorLimit } from '../services/within-actor-limit';

import type { ConnectionTestOutcome, ConnectionTestView } from '../contracts/data-source-views';
import type { ConnectedDataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';
import type { ActorLimitError } from '../services/within-actor-limit';

/**
 * Calls the external system now and records what happened on the source.
 * A failed connection is a recorded outcome, not an error of this
 * operation (see `ConnectionTestOutcome`). The connector always goes to
 * the external system, so each person has a budget of tests.
 */
export class TestDataSourceConnection {
  constructor(private readonly deps: ConnectedDataSourceDependencies) {}

  execute(id: string): AppResultAsync<ConnectionTestView, LoadDataSourceError | ActorLimitError> {
    const { connector, dataSources, audit, clock } = this.deps;

    return loadAuthorizedDataSource(this.deps, id, 'datasource.test')
      .andThen(withinActorLimit(this.deps, DATA_SOURCE_RATE_LIMITS.testConnection))
      .andThen(({ scope, source }) =>
        connector
          .test(source)
          .map((): ConnectionTestOutcome => ({ isHealthy: true }))
          .orElse((error): AppResultAsync<ConnectionTestOutcome, never> =>
            okAsync({ isHealthy: false, errorCode: error.code }),
          )
          .andThen((outcome) => {
            const status = outcome.isHealthy ? 'OK' : 'ERROR';
            const errorCode = outcome.isHealthy ? null : outcome.errorCode;

            return dataSources
              .recordTestResult(source.id, scope.tenantId, {
                status,
                errorCode,
                checkedAt: clock.now(),
              })
              .map(() => {
                audit.record({
                  type: 'data_source.tested',
                  actorId: scope.actorId,
                  tenantId: scope.tenantId,
                  websiteId: source.websiteId,
                  dataSourceId: source.id,
                  outcome: status,
                  errorCode,
                });
                return {
                  dataSourceId: source.id,
                  websiteId: source.websiteId,
                  outcome,
                };
              });
          }),
      );
  }
}
