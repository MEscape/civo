import { z } from 'zod';

import { idSchema } from './booking-fields-schema';

/** Which website's calendar the employee has looked at. */
export const acknowledgeManagerChangeSchema = z.object({ websiteId: idSchema });
