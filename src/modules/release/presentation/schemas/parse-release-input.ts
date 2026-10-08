import { createActionInputParser } from '@lib/actions';

import { RELEASE_ERROR_CODES } from '../../application/contracts/release-constraints';

export const parseReleaseInput = createActionInputParser(RELEASE_ERROR_CODES.validationFailed);
