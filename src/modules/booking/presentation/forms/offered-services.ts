import type { AdoptableServiceDto } from '../dto/service-dto';

export interface OfferedGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly AdoptableServiceDto[];
}

/** By name, the services without a category last. */
function compareCategories(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  return right === null ? -1 : left.localeCompare(right);
}

/** The services a new location could take over, grouped by category (those without one last), each group by name. */
export function groupOffered(
  services: readonly AdoptableServiceDto[],
  noCategoryLabel: string,
): OfferedGroup[] {
  const byCategory = new Map<string | null, AdoptableServiceDto[]>();
  for (const service of services) {
    byCategory.set(service.category, [...(byCategory.get(service.category) ?? []), service]);
  }
  return [...byCategory.entries()]
    .sort(([left], [right]) => compareCategories(left, right))
    .map(([category, items]) => ({
      key: category ?? '',
      label: category ?? noCategoryLabel,
      items,
    }));
}
