import { createHash } from 'node:crypto';
import path from 'node:path';

import { COMPONENT_DEFINITIONS } from '../../src/modules/component-platform/domain/components/component-definitions';
import { CliError, formatHelp, parseArgs } from '../lib/args';
import { PATHS } from '../lib/config';
import { formatSource } from '../lib/format';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';

import type { FlagSpecs } from '../lib/args';

export interface ComponentLockEntry {
  readonly version: number;
  readonly fingerprint: string;
}

export type ComponentLock = Readonly<Record<string, ComponentLockEntry>>;

export const COMPONENT_LOCK_PATH = path.join(REPO_ROOT, PATHS.componentLock);

export const COMPONENT_LOCK_FLAGS = {
  'dry-run': {
    type: 'boolean',
    description: 'Validate and show whether the lock file would change without writing.',
    default: false,
  },
  help: { type: 'boolean', description: 'Show this help.', alias: 'h', default: false },
} as const satisfies FlagSpecs;

const HELP = formatHelp(
  'npm run gen -- component-lock [--dry-run]',
  'Update component-versions.lock.json from the current COMPONENT_DEFINITIONS.',
  COMPONENT_LOCK_FLAGS,
  ['npm run gen -- component-lock', 'npm run gen -- component-lock --dry-run'],
);

type Definition = (typeof COMPONENT_DEFINITIONS)[number];

/** The parts of a definition a stored page can depend on; rendering code is not part of it. */
function fingerprintOf(definition: Definition): string {
  const shape = {
    type: definition.type,
    category: definition.category,
    canHaveChildren: definition.canHaveChildren,
    acceptsChildTypes: definition.acceptsChildTypes,
    fields: definition.fields,
    municipalFields: definition.municipalFields,
    municipallyEditable: definition.municipallyEditable,
    dataBinding: definition.dataBinding,
    dependsOnContracts: definition.dependsOnContracts,
  };
  return createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 16);
}

/** What the lock should say about the components as they are now. */
export function currentComponentLock(): ComponentLock {
  return Object.fromEntries(
    COMPONENT_DEFINITIONS.map((definition) => [
      definition.type,
      { version: definition.version, fingerprint: fingerprintOf(definition) },
    ]),
  );
}

export async function runComponentLock(
  argv: string[],
  options: { root?: string } = {},
): Promise<string> {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, COMPONENT_LOCK_FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }
  if (positionals.length > 0) {
    throw new CliError(`Unexpected argument "${positionals[0]}".`);
  }

  const rawJson = `${JSON.stringify(currentComponentLock(), null, 2)}\n`;
  const formatted = await formatSource(root, PATHS.componentLock, rawJson);

  const plan = new Plan(root);
  if (plan.exists(PATHS.componentLock)) {
    // Line endings are the checkout's business (autocrlf), not a change to the lock.
    if (plan.read(PATHS.componentLock).replaceAll('\r\n', '\n') === formatted) {
      return `${PATHS.componentLock} is up to date.`;
    }
    plan.edit(PATHS.componentLock, () => formatted);
  } else {
    plan.create(PATHS.componentLock, formatted);
  }

  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });
  return formatSummary(summary, dryRun);
}
