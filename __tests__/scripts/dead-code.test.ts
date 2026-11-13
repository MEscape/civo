import { describe, expect, it } from 'vitest';

import { describeFinding, findUnusedExports } from '../../scripts/lib/dead-code';
import { makeTree } from '../architecture/fixture-tree';

import type { ExportUse } from '../../scripts/lib/dead-code';

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    jsx: 'preserve',
    noEmit: true,
    skipLibCheck: true,
    types: [],
    baseUrl: '.',
    paths: { '@lib/*': ['./src/lib/*'] },
  },
  include: ['**/*.ts', '**/*.tsx'],
});

/** The use of each export of the tree, by `file::name`. */
function usesIn(files: Record<string, string>, scope?: string): Record<string, ExportUse> {
  const root = makeTree({ 'tsconfig.json': TSCONFIG, ...files });
  return Object.fromEntries(
    findUnusedExports({ root, ...(scope === undefined ? {} : { scope }) }).map((finding) => [
      `${finding.file}::${finding.name}`,
      finding.use,
    ]),
  );
}

describe('finding exports nothing uses', () => {
  it('sorts an export by who references it', () => {
    const found = usesIn({
      'src/lib/used.ts': 'export const used = 1;',
      'src/lib/dead.ts': 'export const dead = 1;',
      'src/lib/tested.ts': 'export const tested = 1;',
      'src/lib/own.ts':
        'export const own = 1;\nexport const twice = own + 1;\nexport const user = twice;',
      'src/lib/user.ts':
        "import { used } from './used';\nimport { user } from './own';\nexport const run = () => used + user;",
      'src/lib/main.ts':
        "import { run } from './user';\nexport const main = run();\nconsole.log(main);",
      '__tests__/tested.test.ts':
        "import { tested } from '../src/lib/tested';\nconsole.log(tested);",
    });

    expect(found['src/lib/dead.ts::dead']).toBe('dead');
    expect(found['src/lib/tested.ts::tested']).toBe('test-only');
    expect(found['src/lib/own.ts::own']).toBe('unneeded-export');
    expect(found['src/lib/used.ts::used']).toBeUndefined();
    expect(found['src/lib/own.ts::user']).toBeUndefined();
  });

  it('follows an aliased import to the export it names', () => {
    const found = usesIn({
      'src/lib/limits.ts': 'export const LIMITS = { a: 1 } as const;',
      'src/lib/uses.ts': "import { LIMITS as L } from './limits';\nconsole.log(L.a);",
    });

    expect(found['src/lib/limits.ts::LIMITS']).toBeUndefined();
  });

  it('counts a re-export, a star re-export, a namespace import and a path alias as uses', () => {
    const found = usesIn({
      'src/lib/a.ts': 'export const a = 1;',
      'src/lib/b.ts': 'export const b = 1;',
      'src/lib/c.ts': 'export const c = 1;',
      'src/lib/d.ts': 'export const d = 1;',
      'src/lib/barrel.ts': "export { a } from './a';\nexport * from './b';",
      'src/lib/reader.ts':
        "import * as c from './c';\nimport { d } from '@lib/d';\nconsole.log(c.c, d);",
    });

    expect(found).toEqual({});
  });

  it('counts the member taken from a dynamic import', () => {
    const found = usesIn({
      'src/lazy.ts': 'export async function run(): Promise<void> {}',
      'src/loader.ts':
        "export async function load() {\n  const { run } = await import('./lazy');\n  await run();\n}",
    });

    expect(found['src/lazy.ts::run']).toBeUndefined();
    expect(found['src/loader.ts::load']).toBe('dead');
  });

  it('counts a type as an export too, and a type used only in its own file as unneeded', () => {
    const found = usesIn({
      'src/types.ts':
        'export interface Props { a: number }\nexport type Dead = string;\nexport const make = (p: Props) => p.a;',
      'src/app.ts': "import { make } from './types';\nconsole.log(make({ a: 1 }));",
    });

    expect(found['src/types.ts::Props']).toBe('unneeded-export');
    expect(found['src/types.ts::Dead']).toBe('dead');
  });

  it('lets an export say why it stays', () => {
    const found = usesIn({
      'src/keep.ts':
        '/**\n * @keep read by name from the message catalogue test\n */\nexport const byName = 1;\n/** a note without a tag */\nexport const plain = 1;',
    });

    expect(found['src/keep.ts::byName']).toBeUndefined();
    expect(found['src/keep.ts::plain']).toBe('dead');
  });

  it('leaves the files the framework or the public API reads by name', () => {
    const found = usesIn({
      'src/app/[locale]/page.tsx':
        'export const revalidate = 60;\nexport default function Page() { return null; }',
      'src/app/api/route.ts': 'export const GET = () => new Response();',
      'src/modules/shop/index.ts': 'export const publicApi = 1;',
      'src/modules/shop/client.ts': 'export const browserApi = 1;',
      'src/proxy.ts': 'export const config = {};',
    });

    expect(found).toEqual({});
  });

  it('judges only the scope asked for, while every file still counts as a user', () => {
    const files = {
      'src/a/dead.ts': 'export const deadA = 1;',
      'src/b/dead.ts': 'export const deadB = 1;',
      'src/b/uses.ts': "import { deadA } from '../a/dead';\nconsole.log(deadA);",
    };

    expect(usesIn(files, 'src/a/')).toEqual({});
    expect(Object.keys(usesIn(files, 'src/b/'))).toEqual(['src/b/dead.ts::deadB']);
  });

  it('names each finding as file:line, the form editors turn into a link', () => {
    const root = makeTree({ 'tsconfig.json': TSCONFIG, 'src/x.ts': '\n\nexport const dead = 1;' });
    const [finding] = findUnusedExports({ root });

    expect(finding && describeFinding(finding)).toBe('src/x.ts:3  dead (value)');
  });

  it('leaves scratch folders and dependencies out of the program', () => {
    const found = usesIn({
      'src/lib/real.ts': 'export const real = 1;',
      'temp/uses.ts': "import { real } from '../src/lib/real';\nconsole.log(real);",
    });

    expect(found['src/lib/real.ts::real']).toBe('dead');
  });
});
