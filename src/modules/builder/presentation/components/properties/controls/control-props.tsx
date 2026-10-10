import type { JsonValue } from '@lib/utils';

import type { PropFieldDescriptor } from '../../../../application/contracts/builder-constraints';
import type { PageNodeProps } from '../../../../application/contracts/editor-model';

export interface ControlProps {
  /** The element id the row's `<label htmlFor>` points at. */
  readonly id: string;
  /** For controls that are groups rather than labelable elements. */
  readonly labelId: string;
  readonly field: PropFieldDescriptor;
  /** The stored value, or the prop's default while nothing is stored: a control is never blank for a prop that has one. */
  readonly value: JsonValue | undefined;
  /** All props of the node, for controls that depend on a sibling (the datasets a category is read from). */
  readonly nodeProps: PageNodeProps;
  /** `undefined` clears the prop. */
  readonly onChange: (value: JsonValue | undefined) => void;
  /** Ends the current undo step: called on blur and after discrete choices. */
  readonly onCommit: () => void;
}
