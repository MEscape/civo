import { z } from 'zod';

import { ADDRESS_SEARCH_LIMITS } from '../../application/contracts/booking-constraints';

const LANGUAGE_LENGTH = 2;

export const addressSearchSchema = z.object({
  query: z.string().max(ADDRESS_SEARCH_LIMITS.queryMax),
  language: z.string().length(LANGUAGE_LENGTH),
});
