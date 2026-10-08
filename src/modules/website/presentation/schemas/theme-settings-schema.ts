import { z } from 'zod';

import {
  BODY_FONT_FAMILIES,
  HEX_COLOR_PATTERN,
  THEME_FONT_FAMILIES,
  THEME_RADII,
  THEME_SPACING_SCALES,
  WEBSITE_VALIDATION_CODES as CODES,
} from '../../application/contracts/website-constraints';

const colorSchema = z.string().regex(HEX_COLOR_PATTERN, { message: CODES.colorInvalid });

/** Same shape as the theme itself, so the form values ARE the theme (no mapping layer). */
export const themeSettingsSchema = z.object({
  colors: z.object({
    primary: colorSchema,
    secondary: colorSchema,
    accent: colorSchema,
  }),
  typography: z.object({
    headingFont: z.enum(THEME_FONT_FAMILIES, { message: CODES.fontUnsupported }),
    bodyFont: z.enum(BODY_FONT_FAMILIES, { message: CODES.fontUnsupported }),
  }),
  radius: z.enum(THEME_RADII, { message: CODES.radiusUnsupported }),
  spacingScale: z.enum(THEME_SPACING_SCALES, { message: CODES.spacingUnsupported }),
});

export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
