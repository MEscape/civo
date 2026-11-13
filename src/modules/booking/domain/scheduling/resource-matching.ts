/**
 * Gives every demand its own resource, or says it cannot be done. A demand is one unit that needs
 * one resource, named by the ids of the resources that could serve it; a service needing "two
 * staff and a room" is three demands. Two demands may never get the same resource, so a resource
 * that could serve two of them is used where it is needed and the other demand looks elsewhere.
 *
 * This is maximum bipartite matching by augmenting paths: when a demand finds all its candidates
 * taken, it asks the holder of one whether the holder can move to another. A greedy pass would
 * refuse a perfectly good assignment whenever an early demand took the only candidate of a later
 * one, and trying every combination would grow without bound.
 *
 * Deterministic: demands are served in order and candidates tried in the order given, so equal input
 * gives the same assignment. Callers sort candidates by id.
 *
 * @returns the chosen resource id for each demand, in demand order; `null` if some demand cannot
 * be served.
 */
export function matchResources(
  demands: ReadonlyArray<readonly string[]>,
): readonly string[] | null {
  const holderOf = new Map<string, number>();
  const chosen: string[] = [];

  function take(demand: number, resourceId: string): true {
    holderOf.set(resourceId, demand);
    chosen[demand] = resourceId;
    return true;
  }

  function claim(demand: number, visited: Set<string>): boolean {
    const candidates = demands[demand] ?? [];
    // A free resource first, so a demand never displaces an earlier one that has no need to move.
    const free = candidates.find((candidate) => !holderOf.has(candidate));
    if (free !== undefined) {
      return take(demand, free);
    }
    for (const candidate of candidates) {
      const holder = holderOf.get(candidate);
      if (visited.has(candidate) || holder === undefined) {
        continue;
      }
      visited.add(candidate);
      if (claim(holder, visited)) {
        return take(demand, candidate);
      }
    }
    return false;
  }

  for (let demand = 0; demand < demands.length; demand += 1) {
    if (!claim(demand, new Set())) {
      return null;
    }
  }
  // A demand served earlier may have moved to another resource while later ones were placed, so
  // the answer is only complete, and dense, once every demand is placed.
  return chosen;
}
