import { PROP_GROUPS } from '@modules/component-platform/client';
import type { PropGroup } from '@modules/component-platform/client';

import type { PropFieldDescriptor } from '../../application/contracts/builder-constraints';

export interface FieldGroup {
  readonly group: PropGroup;
  readonly fields: readonly PropFieldDescriptor[];
}

export interface GroupedFields {
  readonly ungrouped: readonly PropFieldDescriptor[];
  /** In `PROP_GROUPS` order, so data configuration is always first; empty groups are omitted. */
  readonly groups: readonly FieldGroup[];
}

export function groupFields(fields: readonly PropFieldDescriptor[]): GroupedFields {
  return {
    ungrouped: fields.filter((field) => field.group === null),
    groups: PROP_GROUPS.map((group) => ({
      group,
      fields: fields.filter((field) => field.group === group),
    })).filter((entry) => entry.fields.length > 0),
  };
}
