import { assertNever } from '@lib/utils';

import { ColumnsControl } from './controls/columns-control';
import { DatasetControl } from './controls/dataset-control';
import { ItemsControl } from './controls/items-control';
import { NumberControl } from './controls/number-control';
import { SelectControl } from './controls/select-control';
import { SwitchControl } from './controls/switch-control';
import { TextControl } from './controls/text-control';
import { TextareaControl } from './controls/textarea-control';

import type { ControlProps } from './controls/control-props';

/**
 * One control per descriptor `control` kind. Each emits only values from a
 * bounded set (an option, a column count, a finite number, plain text),
 * never CSS or markup; a list of entries is
 * made of those same plain values. A new control kind fails to compile here until it
 * has a component.
 */
export function PropertyControl(props: ControlProps) {
  switch (props.field.control) {
    case 'text':
      return <TextControl {...props} />;
    case 'textarea':
      return <TextareaControl {...props} />;
    case 'number':
      return <NumberControl {...props} />;
    case 'select':
      return <SelectControl {...props} />;
    case 'columns':
      return <ColumnsControl {...props} />;
    case 'switch':
      return <SwitchControl {...props} />;
    case 'dataset':
      return <DatasetControl {...props} />;
    case 'items':
      return <ItemsControl {...props} />;
    default:
      return assertNever(props.field.control);
  }
}
