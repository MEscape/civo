import { useId } from 'react';

import { Label } from '@components/ui/input';

import type { JsonValue } from '@lib/utils';

import { useComponentText } from '../../hooks/use-component-text';
import { propsEditFinished } from '../../state/builder-actions';
import { useBuilderDispatch } from '../../state/builder-hooks';
import { editNodeProps } from '../../state/props-thunks';

import { PropertyControl } from './property-control';

import type { PropFieldDescriptor } from '../../../application/contracts/builder-constraints';
import type { PageNodeId } from '../../../application/contracts/editor-model';

export interface PropertyFieldRowProps {
  readonly nodeId: PageNodeId;
  readonly field: PropFieldDescriptor;
  readonly value: JsonValue | undefined;
}

/**
 * One labelled control. Edits dispatch on every change (fast local state);
 * `onCommit` ends the undo step on blur or after a discrete choice, so a
 * typing burst is a single undo.
 */
export function PropertyFieldRow({ nodeId, field, value }: PropertyFieldRowProps) {
  const dispatch = useBuilderDispatch();
  const text = useComponentText();
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div className="space-y-1.5">
      <Label id={labelId} htmlFor={id}>
        {text.fieldLabel(field)}
      </Label>
      <PropertyControl
        id={id}
        labelId={labelId}
        field={field}
        value={value}
        onChange={(next) => {
          dispatch(editNodeProps(nodeId, { [field.key]: next }));
        }}
        onCommit={() => dispatch(propsEditFinished())}
      />
    </div>
  );
}
