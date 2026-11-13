import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { tsImport } from 'tsx/esm/api';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const created: string[] = [];

afterEach(async () => {
  for (const directory of created.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture(): Promise<{ directory: string; run: () => Promise<void>; log: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'civo-seed-discovery-'));
  created.push(directory);
  const helper = join(directory, 'helper');
  const log = join(directory, 'execution.txt');
  await mkdir(helper);
  await writeFile(join(directory, 'package.json'), '{ "type": "module" }');
  await copyFile(join(ROOT, 'prisma/seed/helper/index.ts'), join(helper, 'index.ts'));
  await writeFile(
    join(helper, 'seed-context.ts'),
    `import { appendFileSync } from 'node:fs';
export const tally = { created: 0, skipped: 0 };
export function say(message: string) {
  appendFileSync(${JSON.stringify(log)}, message + '\\n');
}
`,
  );
  await writeFile(
    join(helper, 'ignored.seed.ts'),
    "throw new Error('Helper must not be imported');",
  );
  await writeFile(join(directory, 'notes.ts'), "throw new Error('Only seed modules may run');");
  const imported: unknown = await tsImport(pathToFileURL(join(helper, 'index.ts')).href, {
    parentURL: import.meta.url,
    tsconfig: join(ROOT, 'tsconfig.json'),
  });
  if (
    typeof imported !== 'object' ||
    imported === null ||
    !('runSeeds' in imported) ||
    typeof imported.runSeeds !== 'function'
  ) {
    throw new Error('Seed fixture did not expose runSeeds');
  }
  const runSeeds = imported.runSeeds as () => Promise<void>;
  return { directory, run: runSeeds, log };
}

async function seed(
  directory: string,
  options: { file: string; name: string; order?: number; enabled?: boolean },
): Promise<void> {
  const { file, ...settings } = options;
  await writeFile(
    join(directory, `${file}.seed.ts`),
    `export default {
  ...${JSON.stringify(settings)},
  async run(context) {
    context.say('executed:' + this.name);
    context.tally.created += 1;
  }
};`,
  );
}

describe('seed discovery', () => {
  it('runs modules beside helper in explicit order, then default order and name order', async () => {
    const { directory, run, log } = await fixture();
    await seed(directory, { file: 'a-last', name: 'Last', order: 200 });
    await seed(directory, { file: 'z-first', name: 'First', order: 1 });
    await seed(directory, { file: 'b-default', name: 'Zulu' });
    await seed(directory, { file: 'c-default', name: 'Alpha', order: 100 });

    await run();

    const output = await readFile(log, 'utf8');
    expect(output.match(/executed:[^\n]+/g)).toEqual([
      'executed:First',
      'executed:Alpha',
      'executed:Zulu',
      'executed:Last',
    ]);
    expect(output).toContain('Seed done: 4 created, 0 already there.');
  });

  it('reports disabled modules without running them', async () => {
    const { directory, run, log } = await fixture();
    await seed(directory, { file: 'disabled', name: 'Disabled', enabled: false });
    await seed(directory, { file: 'enabled', name: 'Enabled' });

    await run();

    const output = await readFile(log, 'utf8');
    expect(output).toContain('Skipping disabled seed: Disabled');
    expect(output).not.toContain('executed:Disabled');
    expect(output).toContain('executed:Enabled');
  });

  it('rejects malformed seed exports before running any module', async () => {
    const { directory, run } = await fixture();
    await writeFile(join(directory, 'broken.seed.ts'), 'export default { name: "Broken" };');

    await expect(run()).rejects.toThrow('Invalid seed module "broken.seed.ts".');
  });
});
