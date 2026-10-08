import { createActionInputParser } from '@lib/actions';

import { BUILDER_ERROR_CODES } from '../../application/contracts/builder-constraints';

export const parseBuilderInput = createActionInputParser(BUILDER_ERROR_CODES.validationFailed);
