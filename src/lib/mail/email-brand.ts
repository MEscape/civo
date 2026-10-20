import { APP_IDENTITY } from '@lib/config';
import { invariant, parseHexColor, readableCopy, readableForeground, toHexColor } from '@lib/utils';

/**
 * Who a message looks like, resolved to LITERAL values: mail clients read neither CSS custom
 * properties nor `color-mix()`. The renderer takes everything it draws from here and holds no
 * colour, length or font of its own.
 */
export interface EmailBrand {
  /**
   * Who speaks: the platform (sign-in, invitations) carries the Artemis Connect logo above the
   * card; a website keeps its own look and names the platform only in a small line below it.
   */
  readonly sender: 'platform' | 'website';
  readonly color: {
    /** The button's fill and the card's top edge. */
    readonly primary: string;
    /** Text on the button. */
    readonly primaryForeground: string;
    /** The brand colour as link text on the card. */
    readonly primaryCopy: string;
    /** The page behind the card, the card, its text, muted text and rules. The same for every brand. */
    readonly canvas: string;
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
  };
  /** A CSS length for the card, the facts box and the button. */
  readonly radius: string;
  /** A CSS length: the space inside the card. */
  readonly padding: string;
  /** Font stacks that end in a system font, because a webfont never loads in a mail client. */
  readonly font: {
    readonly heading: string;
    readonly body: string;
    /** For a reference a person may read out or copy. */
    readonly mono: string;
  };
}

/** What a website's stored theme offers. Every field is untrusted: a value this does not know is the platform's. */
export interface EmailThemeInput {
  /** `#rrggbb`. */
  readonly primary: string;
  readonly radius?: string | null | undefined;
  readonly headingFont?: string | null | undefined;
  readonly bodyFont?: string | null | undefined;
  readonly spacingScale?: string | null | undefined;
}

/*
 * The tokens of a website theme and what each means in a mail. A closed list, so nothing stored is
 * ever written into a style attribute: the keys are the website domain's own (`THEME_RADII`,
 * `THEME_FONT_FAMILIES`, `THEME_SPACING_SCALES`), and a test walks those lists against these.
 */
const RADII: ReadonlyMap<string, string> = new Map([
  ['none', '0px'],
  ['sm', '2px'],
  ['md', '6px'],
  ['lg', '12px'],
]);

const PADDINGS: ReadonlyMap<string, string> = new Map([
  ['compact', '24px'],
  ['comfortable', '32px'],
  ['spacious', '40px'],
]);

const SYSTEM_SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_STACKS: ReadonlyMap<string, string> = new Map([
  ['Source Serif 4', "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif"],
  ['Inter', `Inter, ${SYSTEM_SANS}`],
  ['DM Sans', `'DM Sans', ${SYSTEM_SANS}`],
  ['Geist', `Geist, ${SYSTEM_SANS}`],
]);

const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** The value of `token`, else the platform's own choice. */
function resolve(
  table: ReadonlyMap<string, string>,
  token: string | null | undefined,
  platformToken: string,
): string {
  const value = table.get(token ?? '') ?? table.get(platformToken);
  invariant(value !== undefined, `The platform theme names "${platformToken}", which is unknown.`);
  return value;
}

type BrandColors = Pick<EmailBrand['color'], 'primary' | 'primaryForeground' | 'primaryCopy'>;

const PLATFORM_COLORS: BrandColors = {
  primary: APP_IDENTITY.colors.primary,
  primaryForeground: APP_IDENTITY.colors.primaryForeground,
  primaryCopy: APP_IDENTITY.colors.primaryCopy,
};

function brandOf(
  sender: EmailBrand['sender'],
  colors: BrandColors,
  theme: Omit<EmailThemeInput, 'primary'>,
): EmailBrand {
  const platform = APP_IDENTITY.theme;
  return {
    sender,
    color: {
      ...colors,
      canvas: APP_IDENTITY.colors.background,
      surface: APP_IDENTITY.colors.surface,
      text: APP_IDENTITY.colors.text,
      textMuted: APP_IDENTITY.colors.textMuted,
      border: APP_IDENTITY.colors.border,
    },
    radius: resolve(RADII, theme.radius, platform.radius),
    padding: resolve(PADDINGS, theme.spacingScale, platform.spacingScale),
    font: {
      heading: resolve(FONT_STACKS, theme.headingFont, platform.headingFont),
      body: resolve(FONT_STACKS, theme.bodyFont, platform.bodyFont),
      mono: MONO_STACK,
    },
  };
}

/**
 * The platform's own look, for mail that belongs to the platform itself (sign-in) and not to a
 * website. Taken from `APP_IDENTITY`, which a test pins to `globals.css`.
 */
export const PLATFORM_EMAIL_BRAND: EmailBrand = brandOf('platform', PLATFORM_COLORS, {});

/**
 * The look of a website's mail from its theme: the platform's layout with the website's primary
 * colour on the button and the card edge, a readable text on the button and a readable link colour
 * on the card (derived by the same rules as the website itself), and its corner radius, fonts and
 * spacing. A colour that is not `#rrggbb`, or a token that is not one of the theme's, gives the
 * platform's choice for that part; the message still speaks for the website.
 */
export function createEmailBrand(theme: EmailThemeInput): EmailBrand {
  const channels = parseHexColor(theme.primary);
  if (channels === null) {
    return brandOf('website', PLATFORM_COLORS, theme);
  }
  const primary = toHexColor(channels);
  return brandOf(
    'website',
    {
      primary,
      primaryForeground: readableForeground(primary),
      primaryCopy: readableCopy(primary),
    },
    theme,
  );
}
