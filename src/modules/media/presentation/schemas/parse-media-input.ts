import { createActionInputParser } from '@lib/actions';

import { MEDIA_ERROR_CODES } from '../../application/contracts/media-constraints';

export const parseMediaInput = createActionInputParser(MEDIA_ERROR_CODES.validationFailed);
