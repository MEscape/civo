/**
 * scripts/component-version-lock.ts
 *
 * Records, per registered component, the `version` it declares next to a
 * fingerprint of what a stored page can depend on: its props, children rules
 * and data binding. `__tests__/architecture/component-versions.test.ts`
 * fails when that shape changed while the `version` did not, so a change a
 * published release must not pick up silently cannot ship unnoticed.
 *
 * Update the lock (after bumping `version` where the test asks for it):
 *   npm run components:lock
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { COMPONENT_DEFINITIONS } from '../src/modules/component-platform/domain/components/component-definitions';

export interface ComponentLockEntry {
  readonly version: number;
  readonly fingerprint: string;
}

export type ComponentLock = Readonly<Record<string, ComponentLockEntry>>;

export const COMPONENT_LOCK_PATH = join(
  process.cwd(),
  'src/modules/component-platform/domain/components/component-versions.lock.json',
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

if (process.argv[1]?.endsWith('component-version-lock.ts') === true) {
  writeFileSync(COMPONENT_LOCK_PATH, `${JSON.stringify(currentComponentLock(), null, 2)}\n`);
}
