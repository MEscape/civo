import { createActionInputParser } from '@lib/actions';

import { WEBSITE_ERROR_CODES } from '../../application/contracts/website-constraints';

export const parseWebsiteInput = createActionInputParser(WEBSITE_ERROR_CODES.validationFailed);
