import { useTranslations } from '@i18n/client';

import { GROUP_MESSAGE_KEYS } from '../../messages/message-keys';
import { groupFields } from '../../properties/group-fields';

import { PropertyFieldRow } from './property-field-row';

import type { PropFieldDescriptor } from '../../../application/contracts/builder-constraints';
import type { PageNodeId, PageNodeProps } from '../../../application/contracts/editor-model';

export interface PropertyFieldGroupsProps {
  readonly nodeId: PageNodeId;
  readonly fields: readonly PropFieldDescriptor[];
  readonly props: PageNodeProps;
}

function FieldList({ nodeId, fields, props }: PropertyFieldGroupsProps) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <PropertyFieldRow key={field.key} nodeId={nodeId} field={field} value={props[field.key]} />
      ))}
    </div>
  );
}

/** Ungrouped fields first, then one labelled group per category in data, content, appearance order. */
export function PropertyFieldGroups({ nodeId, fields, props }: PropertyFieldGroupsProps) {
  const t = useTranslations('builder');
  const { ungrouped, groups } = groupFields(fields);

  return (
    <div className="flex flex-col gap-6">
      {ungrouped.length > 0 && <FieldList nodeId={nodeId} fields={ungrouped} props={props} />}
      {groups.map(({ group, fields: groupFieldsList }) => (
        <fieldset key={group} className="space-y-3">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-copy-muted">
            {t(GROUP_MESSAGE_KEYS[group])}
          </legend>
          <FieldList nodeId={nodeId} fields={groupFieldsList} props={props} />
        </fieldset>
      ))}
    </div>
  );
}
