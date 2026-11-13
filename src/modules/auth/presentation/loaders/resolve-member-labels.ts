import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

/**
 * The names of members by id, for a screen that keeps only ids (who published, who acted). `null`
 * while the directory cannot say: the screen then shows what it has instead of guessing.
 */
export async function resolveMemberLabels(
  ids: ReadonlyArray<string | null | undefined>,
  resolve: (ids: readonly string[]) => AppResultAsync<{
    readonly names: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  }>,
): Promise<Readonly<Record<string, string>> | null> {
  const wanted = unique(ids.filter((id): id is string => typeof id === 'string' && id !== ''));
  if (wanted.length === 0) {
    return {};
  }
  const resolved = await resolve(wanted);
  return resolved.isOk()
    ? Object.fromEntries(resolved.value.names.map(({ id, name }) => [id, name]))
    : null;
}
