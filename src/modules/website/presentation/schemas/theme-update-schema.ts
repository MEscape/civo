import { z } from 'zod';

import { themeSettingsSchema } from './theme-settings-schema';
import { websiteIdSchema } from './website-fields-schema';

/** The theme is addressed through its website, never by a client-supplied theme id. */
export const themeUpdateSchema = z.object({
  websiteId: websiteIdSchema,
  theme: themeSettingsSchema,
});

export type ThemeUpdate = z.infer<typeof themeUpdateSchema>;
