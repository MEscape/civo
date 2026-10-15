import { z } from 'zod';

import { RELEASE_NOTE_MAX_LENGTH } from '../../application/contracts/release-constraints';

import { websiteIdSchema } from './release-fields-schema';

export const publishReleaseSchema = z.object({
  websiteId: websiteIdSchema,
  note: z.string().max(RELEASE_NOTE_MAX_LENGTH).optional(),
});

export type PublishRelease = z.infer<typeof publishReleaseSchema>;
