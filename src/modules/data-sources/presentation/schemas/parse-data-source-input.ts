import { createActionInputParser } from '@lib/actions';

import { DATA_SOURCE_ERROR_CODES } from '../../application/contracts/data-source-constraints';

export const parseDataSourceInput = createActionInputParser(
  DATA_SOURCE_ERROR_CODES.validationFailed,
);
