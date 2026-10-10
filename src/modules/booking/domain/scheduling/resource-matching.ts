import type { BookableResourceId } from '../models/ids';

/** One unit of one requirement, with the resources that could fill it, best first. */
export interface ResourceDemand {
  readonly candidates: readonly BookableResourceId[];
}

/**
 * Fills every demand with a different resource, or reports that it cannot.
 *
 * Two requirements can be satisfied by the same person (an employee with both
 * skills), so choosing greedily per requirement can fail where an assignment
 * exists. This is bipartite matching, solved exactly with augmenting paths:
 * if any assignment exists, this finds one, and the order of `candidates`
 * decides which of several is preferred.
 */
export function matchResources(
  demands: readonly ResourceDemand[],
): readonly BookableResourceId[] | null {
  // Most constrained first: it fails fast and leaves the flexible demands for last.
  const order = demands
    .map((demand, index) => ({ demand, index }))
    .sort((a, b) => a.demand.candidates.length - b.demand.candidates.length);

  const demandOf = new Map<BookableResourceId, number>();

  function assign(demandIndex: number, visited: Set<BookableResourceId>): boolean {
    const demand = demands[demandIndex];
    if (demand === undefined) {
      return false;
    }
    for (const resourceId of demand.candidates) {
      if (visited.has(resourceId)) {
        continue;
      }
      visited.add(resourceId);
      const holder = demandOf.get(resourceId);
      if (holder === undefined || assign(holder, visited)) {
        demandOf.set(resourceId, demandIndex);
        return true;
      }
    }
    return false;
  }

  for (const { index } of order) {
    if (!assign(index, new Set())) {
      return null;
    }
  }
  return [...demandOf.keys()];
}
