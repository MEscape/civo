import { describe, expect, it } from 'vitest';

import { policyProblem } from '@lib/rate-limit/rate-limit-policy';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

import { describeRateLimitPolicies } from '../../eslint/policy/checks-rate-limits.mjs';
import { loadProject } from '../../eslint/policy/index.mjs';
import { RATE_LIMIT_POLICIES } from '../../eslint/policy/policy.mjs';

/**
 * Every module declares its rate-limit policies as plain data in `application/rate-limits.ts`.
 * `eslint/policy/checks-rate-limits.mjs` (run with the other whole-tree checks in
 * `repository.test.ts`) reads them as syntax: namespaced, unique, explicit about how they fail,
 * spent by a use case. This test imports them as the limiter does, so what only values can show
 * holds too: every policy is valid, and the reviewed list of fail-open policies is exact.
 */
const project = loadProject(process.cwd());
const declared = describeRateLimitPolicies(project) as Array<{
  readonly module: string;
  readonly exportName: string;
  readonly key: string;
  readonly id: string;
  readonly onBackendFailure: string;
}>;

const policyFiles = import.meta.glob<Record<string, Record<string, RateLimitPolicy>>>(
  '/src/modules/*/application/rate-limits.ts',
  { eager: true },
);

const imported = Object.entries(policyFiles).flatMap(([file, exports]) => {
  const moduleName = /\/src\/modules\/([^/]+)\//.exec(file)?.[1] ?? '';
  return Object.values(exports).flatMap((group) =>
    Object.values(group).map((policy) => ({ moduleName, policy })),
  );
});

describe('rate-limit policies across modules', () => {
  it('finds the policies of every module that limits something (the glob matched something real)', () => {
    const modules = [...new Set(declared.map((entry) => entry.module))].sort();

    expect(modules).toEqual([
      'auth',
      'booking',
      'builder',
      'component-platform',
      'data-sources',
      'release',
    ]);
    expect(declared.length).toBeGreaterThanOrEqual(20);
  });

  it('reads the same policies from the syntax and from the values', () => {
    expect(imported.map(({ policy }) => policy.id).sort()).toEqual(
      declared.map((entry) => entry.id).sort(),
    );
  });

  it('declares only valid policies (id, limit, window, explicit failure mode)', () => {
    const problems = imported
      .map(({ moduleName, policy }) => ({
        moduleName,
        id: policy.id,
        problem: policyProblem(policy),
      }))
      .filter((entry) => entry.problem !== null);

    expect(problems).toEqual([]);
  });

  it('lets exactly the reviewed policies fail open', () => {
    const failOpen = declared
      .filter((entry) => entry.onBackendFailure === 'allow')
      .map((entry) => entry.id)
      .sort();

    expect(failOpen).toEqual([...RATE_LIMIT_POLICIES.failOpen].sort());
  });
});
