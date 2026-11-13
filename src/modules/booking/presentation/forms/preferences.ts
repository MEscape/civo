import { removeAt } from '@lib/utils';

import type { PreferencesDto } from '../dto/employee-dto';

/** Adds an id at the end or takes it out. */
export function toggleId(ids: readonly string[], id: string): string[] {
  const at = ids.indexOf(id);
  return at === -1 ? [...ids, id] : removeAt(ids, at);
}

export interface ServiceGroup {
  /** `null`: services without a category. */
  readonly category: string | null;
  readonly services: PreferencesDto['services'];
  /** How many of the group's services are chosen, of all of them (the search aside). */
  readonly chosen: number;
  readonly total: number;
}

/** The services by category, in the order given, each group only with what matches the search. */
export function serviceGroups(
  services: PreferencesDto['services'],
  chosen: readonly string[],
  search: string,
): ServiceGroup[] {
  const needle = search.trim().toLocaleLowerCase();
  const groups = new Map<string | null, Array<PreferencesDto['services'][number]>>();
  for (const service of services) {
    groups.set(service.category, [...(groups.get(service.category) ?? []), service]);
  }
  return [...groups.entries()]
    .map(([category, members]) => ({
      category,
      services: members.filter((service) => service.name.toLocaleLowerCase().includes(needle)),
      chosen: members.filter((service) => chosen.includes(service.id)).length,
      total: members.length,
    }))
    .filter((group) => group.services.length > 0);
}
