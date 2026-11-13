import 'server-only';

import { getAuthQueries } from '../../../composition';
import { resolveMemberLabels } from '../../loaders/resolve-member-labels';

/** Presentation enrichment uses the same authorized directory query as member screens. */
export const loadMemberNames = (ids: ReadonlyArray<string | null | undefined>) =>
  resolveMemberLabels(ids, (wanted) => getAuthQueries().resolveMemberNames.execute(wanted));
