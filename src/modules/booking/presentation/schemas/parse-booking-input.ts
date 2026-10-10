import { createActionInputParser } from '@lib/actions';

import { BOOKING_ERROR_CODES } from '../../application/contracts/booking-constraints';

/** Validates untrusted Server Action input and reports failure with the module's "invalid input" code. */
export const parseBookingInput = createActionInputParser(BOOKING_ERROR_CODES.validationFailed);
