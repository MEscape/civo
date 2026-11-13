import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  DATA_SOURCE_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/data-source-errors';
import { isCanonicalKind } from '../../domain/models/canonical-kinds';
import { parseWebsiteId } from '../../domain/models/ids';
import { toDatasetView } from '../data-source-view-mappers';
import { MAX_COMPATIBLE_DATASETS } from '../data-sources-limits';

import type { CanonicalKind } from '../../domain/models/canonical-kinds';
import type { DatasetChoicesView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

function parseCanonicalKind(raw: string): AppResult<CanonicalKind, ValidationAppError> {
  return isCanonicalKind(raw)
    ? ok(raw)
    : err(
        fieldValidationFailed('canonicalKind', DATA_SOURCE_VALIDATION_CODES.canonicalKindUnknown),
      );
}

/**
 * Datasets of one canonical kind within a website: the builder's dataset
 * selector. Authorization comes first, then the inputs are checked.
 * Always bounded.
 */
export class ListCompatibleDatasets {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(input: {
    websiteId: string;
    canonicalKinds: readonly string[];
  }): AppResultAsync<
    DatasetChoicesView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { access, datasets } = this.deps;
    const { websiteId, canonicalKinds } = input;

    return access
      .authorizeWebsite('dataset.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId)
          .andThen((id) => {
            const parsedKinds: CanonicalKind[] = [];
            for (const kind of canonicalKinds) {
              const parsed = parseCanonicalKind(kind);
              if (parsed.isErr()) {
                return err(parsed.error);
              }
              parsedKinds.push(parsed.value);
            }
            return ok({ id, kinds: parsedKinds });
          })
          .asyncAndThen(({ id, kinds }) =>
            kinds.length === 0
              ? okAsync({ items: [], isTruncated: false })
              : datasets.listCompatible({
                  websiteId: id,
                  tenantId: scope.tenantId,
                  canonicalKinds: kinds,
                  limit: MAX_COMPATIBLE_DATASETS,
                }),
          ),
      )
      .map((found) => ({ items: found.items.map(toDatasetView), isTruncated: found.isTruncated }));
  }
}
