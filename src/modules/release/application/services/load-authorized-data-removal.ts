import type { AppResultAsync } from '@lib/result';

import { parseDataSourceId, parseDatasetId } from '../../domain/models/ids';

import type { DataRemovalAuthority, DataRemovalError } from '../../domain/ports/data-source.port';
import type { DeleteUnusedDataInput } from '../contracts/data-removal-inputs';
import type { DeleteUnusedDataDependencies } from '../release-dependencies';

/** The data module resolves DELETE permission from stored ownership; this module never guesses its website. */
export function loadAuthorizedDataRemoval(
  deps: DeleteUnusedDataDependencies,
  input: DeleteUnusedDataInput,
): AppResultAsync<DataRemovalAuthority, DataRemovalError> {
  return deps.authorization.requireActor().andThen(() => {
    if (input.kind === 'dataset') {
      return parseDatasetId(input.id).asyncAndThen((id) =>
        deps.data.authorizeRemoval('dataset', id),
      );
    }
    return parseDataSourceId(input.id).asyncAndThen((id) =>
      deps.data.authorizeRemoval('source', id),
    );
  });
}
