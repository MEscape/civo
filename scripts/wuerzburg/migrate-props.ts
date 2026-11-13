import { readFile, writeFile } from 'node:fs/promises';

import { isPlainObject } from '../../src/lib/utils';
import { migrateCategoryProps } from '../../src/modules/component-platform/domain/components/legacy-component-props';

const MAX_DEPTH = 12;
const MAX_NODES = 500;
const MAX_BYTES = 1_000_000;
let visited = 0;

function migrateNode(raw: unknown, depth: number): unknown {
  visited += 1;
  if (depth > MAX_DEPTH || visited > MAX_NODES) {
    throw new Error('Page exceeds builder migration bounds');
  }
  if (!isPlainObject(raw)) {
    throw new Error('Expected a page node object');
  }
  const type = raw['type'];
  return {
    ...raw,
    ...(typeof type === 'string' && 'props' in raw
      ? { props: migrateCategoryProps(type, raw['props']) }
      : {}),
    ...(Array.isArray(raw['children'])
      ? { children: raw['children'].map((child: unknown) => migrateNode(child, depth + 1)) }
      : {}),
  };
}

const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined) {
  throw new Error(
    'Usage: tsx scripts/wuerzburg/migrate-props.ts <page-config.json> <new-output.json>',
  );
}
const source = await readFile(input);
if (source.byteLength > MAX_BYTES) {
  throw new Error('Page exceeds builder migration size bound');
}
const raw: unknown = JSON.parse(source.toString('utf8'));
const migrated = migrateNode(raw, 0);
await writeFile(output, `${JSON.stringify(migrated, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(
  `Wrote a reviewable migration for ${visited} nodes. Existing input and published releases remain unchanged.\n`,
);
