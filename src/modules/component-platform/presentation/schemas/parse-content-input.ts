import { createActionInputParser } from '@lib/actions';

import { COMPONENT_PLATFORM_ERROR_CODES } from '../../application/contracts/component-platform-constraints';

/** Validates untrusted Server Action input and reports failure with the module's "invalid request" code. */
export const parseContentInput = createActionInputParser(
  COMPONENT_PLATFORM_ERROR_CODES.requestInvalid,
);
