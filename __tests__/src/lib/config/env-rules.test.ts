import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { envRuleIssues, refineEnv } from '@lib/config/env-rules';
import type { EnvRule } from '@lib/config/env-rules';

interface Env {
  readonly MODE: 'on' | 'off';
  readonly SECRET?: string | undefined;
}

const RULES: ReadonlyArray<EnvRule<Env>> = [
  {
    path: 'SECRET',
    violated: (env) => env.MODE === 'on' && env.SECRET === undefined,
    message: 'SECRET is required while MODE is on.',
  },
  {
    path: 'MODE',
    violated: (env) => env.SECRET === 'bad',
    message: (env) => `MODE cannot go with ${env.SECRET}.`,
  },
];

describe('envRuleIssues', () => {
  it('reports nothing for a rule whose mode does not apply', () => {
    expect(envRuleIssues({ MODE: 'off' }, RULES)).toEqual([]);
  });

  it('reports each violated rule on its variable, in the order listed', () => {
    expect(envRuleIssues({ MODE: 'on' }, RULES)).toEqual([
      { path: 'SECRET', message: 'SECRET is required while MODE is on.' },
    ]);
    expect(envRuleIssues({ MODE: 'off', SECRET: 'bad' }, RULES)).toEqual([
      { path: 'MODE', message: 'MODE cannot go with bad.' },
    ]);
  });
});

describe('refineEnv', () => {
  const schema = z
    .object({ MODE: z.enum(['on', 'off']), SECRET: z.string().optional() })
    .superRefine(refineEnv(RULES));

  it('turns the violations into issues on the variables', () => {
    const result = schema.safeParse({ MODE: 'on' });

    expect(result.error?.issues.map((issue) => [issue.path, issue.message])).toEqual([
      [['SECRET'], 'SECRET is required while MODE is on.'],
    ]);
  });

  it('accepts a configuration that breaks no rule', () => {
    expect(schema.safeParse({ MODE: 'on', SECRET: 'x' }).success).toBe(true);
  });
});
