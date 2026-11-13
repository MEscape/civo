import { describe, expect, it } from 'vitest';

import { matchResources } from '@modules/booking/domain/scheduling/resource-matching';

describe('matching resources to demands', () => {
  it('serves no demands with no resources', () => {
    expect(matchResources([])).toEqual([]);
  });

  it('gives each demand the first candidate it lists', () => {
    expect(matchResources([['anna', 'ben'], ['carl']])).toEqual(['anna', 'carl']);
  });

  it('never gives two demands the same resource', () => {
    expect(matchResources([['anna'], ['anna']])).toBeNull();
    expect(
      matchResources([
        ['anna', 'ben'],
        ['anna', 'ben'],
      ]),
    ).toEqual(['anna', 'ben']);
  });

  it('moves an earlier demand aside when a later one has only that resource', () => {
    // A greedy pass gives anna to the first demand and then fails the second.
    expect(matchResources([['anna', 'ben'], ['anna']])).toEqual(['ben', 'anna']);
  });

  it('follows a chain of reassignments to find a valid assignment', () => {
    const result = matchResources([['a', 'b'], ['b', 'c'], ['c', 'd'], ['a']]);
    expect(result).not.toBeNull();
    expect(new Set(result).size).toBe(4);
    expect(result?.[3]).toBe('a');
  });

  it('is null when a demand has no candidate at all', () => {
    expect(matchResources([['anna'], []])).toBeNull();
  });

  it('is null when there are more demands than resources', () => {
    expect(
      matchResources([
        ['a', 'b'],
        ['a', 'b'],
        ['a', 'b'],
      ]),
    ).toBeNull();
  });

  it('is deterministic: the same input gives the same answer', () => {
    const demands = [
      ['b', 'a'],
      ['a', 'c'],
      ['c', 'b'],
    ];
    expect(matchResources(demands)).toEqual(matchResources(demands));
  });

  it('refuses an impossible request quickly instead of trying every combination', () => {
    const pool = Array.from({ length: 29 }, (_, index) => `r${index}`);
    const demands = Array.from({ length: 30 }, () => pool);
    const startedAt = performance.now();

    expect(matchResources(demands)).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it('agrees with exhaustive search on whether an assignment exists, for 300 random cases', () => {
    let state = 7;
    const next = (limit: number) => {
      state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
      return state % limit;
    };
    const ids = ['a', 'b', 'c', 'd'];

    function exists(demands: string[][], used: Set<string>, from: number): boolean {
      const candidates = demands[from];
      if (candidates === undefined) {
        return true;
      }
      return candidates.some((id) => {
        if (used.has(id)) {
          return false;
        }
        used.add(id);
        const found = exists(demands, used, from + 1);
        used.delete(id);
        return found;
      });
    }

    for (let round = 0; round < 300; round += 1) {
      const demands = Array.from({ length: 1 + next(4) }, () => ids.filter(() => next(2) === 0));
      const result = matchResources(demands);

      expect(result !== null).toBe(exists(demands, new Set(), 0));
      if (result !== null) {
        expect(new Set(result).size).toBe(result.length);
        result.forEach((id, demand) => {
          expect(demands[demand]).toContain(id);
        });
      }
    }
  });
});
