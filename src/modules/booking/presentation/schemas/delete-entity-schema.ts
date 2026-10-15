import { z } from 'zod';

import { idSchema } from './booking-fields-schema';

/** Remove a location, a service or a resource: the website it is in, and which one. */
export const deleteEntitySchema = z.object({
  websiteId: idSchema,
  id: idSchema,
});
