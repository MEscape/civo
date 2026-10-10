import { z } from 'zod';

const DEFAULT_PUBLIC_APP_URL = 'http://localhost:3000';
const DEFAULT_MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/light-v11';

/** Only Mapbox-hosted styles: the map must not load a style from an arbitrary address. */
const MAPBOX_STYLE_URL_PATTERN = /^mapbox:\/\/styles\/[\w-]+\/[\w-]+$/;

/**
 * Public configuration.
 *
 * Only values explicitly intended for the client belong here. This file has
 * no server dependency so it can sit in a browser bundle.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default(DEFAULT_PUBLIC_APP_URL),

  /**
   * A Mapbox PUBLIC token (`pk.…`), which Mapbox designs to be shipped to the
   * browser and which should be URL-restricted in the Mapbox account. Never
   * put a secret token (`sk.…`) here. Without it the map still works as a
   * list, only the map background is unavailable.
   */
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z
    .string()
    .regex(/^pk\./, 'Must be a Mapbox public token (pk.…).')
    .optional(),

  NEXT_PUBLIC_MAPBOX_STYLE_URL: z
    .string()
    .regex(MAPBOX_STYLE_URL_PATTERN, 'Must look like mapbox://styles/<owner>/<style>.')
    .default(DEFAULT_MAPBOX_STYLE_URL),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
