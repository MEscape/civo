import { getAuthQueries, isAuthEnabled } from '@modules/auth';

import { orNull } from './or-fail';

/**
 * The names of the people behind some actor ids, for "published by …". Without
 * sign-in there are no accounts to name, and an id that is no member of the
 * tenant (someone who left) simply has no name: the screen then says nothing
 * rather than a stranger's id.
 */
export async function loadMemberNames(
  ids: ReadonlyArray<string | null>,
): Promise<Readonly<Record<string, string>> | null> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  // Without sign-in there are no accounts to name: `null` says "unknown", which is not the same as "left".
  if (!isAuthEnabled) {
    return null;
  }
  if (unique.length === 0) {
    return {};
  }
  const names = await orNull(getAuthQueries().resolveMemberNames.execute(unique));
  return Object.fromEntries((names ?? []).map(({ id, name }) => [id, name]));
}
