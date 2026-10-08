import type { JsonValue } from '@lib/utils';

import type { PropFieldDescriptor } from '../../../../application/contracts/builder-constraints';

export interface ControlProps {
  /** The element id the row's `<label htmlFor>` points at. */
  readonly id: string;
  /** For controls that are groups rather than labelable elements. */
  readonly labelId: string;
  readonly field: PropFieldDescriptor;
  readonly value: JsonValue | undefined;
  /** `undefined` clears the prop. */
  readonly onChange: (value: JsonValue | undefined) => void;
  /** Ends the current undo step: called on blur and after discrete choices. */
  readonly onCommit: () => void;
}
