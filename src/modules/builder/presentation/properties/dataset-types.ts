import { isDefined, unique } from '@lib/utils';

import type { ComponentDescriptor } from '../../application/contracts/builder-constraints';

/** The dataset types the editor's controls can ask for, so the route loads exactly those and nothing else. */
export function collectDatasetTypes(components: readonly ComponentDescriptor[]): readonly string[] {
  return unique(
    components
      .flatMap((component) => component.fields.map((field) => field.canonicalKind))
      .filter(isDefined),
  );
}
