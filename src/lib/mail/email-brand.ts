import { parseHexColor, readableCopy, readableForeground, toHexColor } from '@lib/utils';

/**
 * The colours and corner radius a message takes from the website it speaks
 * for. Email clients support neither CSS variables nor `color-mix()`, so the
 * values are literal; a caller that knows a website passes that website's
 * theme here, everything else gets `PLATFORM_EMAIL_BRAND`.
 */
export interface EmailBrand {
  /**
   * Who speaks: the platform (sign-in, invitations) carries the Artemis
   * Connect logo above the card; a website keeps its own look and names the
   * platform only in a small line below it.
   */
  readonly sender: 'platform' | 'website';
  /** The button's fill and the card's top edge. */
  readonly primary: string;
  /** Text on the button. */
  readonly primaryForeground: string;
  /** The brand colour as link text on the white card. */
  readonly primaryCopy: string;
  /** A CSS length for the card, the facts box and the button. */
  readonly radius: string;
}

/**
 * Literal copies of the platform default theme in global.css, for mail that
 * belongs to the platform itself (sign-in) and not to a website.
 * Keep in sync with `:root` in global.css (a test pins them).
 */
export const PLATFORM_EMAIL_BRAND: EmailBrand = {
  sender: 'platform',
  primary: '#1f3a34', // --civo-color-primary
  primaryForeground: '#ffffff', // --civo-color-primary-foreground
  primaryCopy: '#1f3a34', // --civo-color-primary-copy
  radius: '6px', // --civo-radius
};

/**
 * The look of a website's mail from its primary colour: the platform's layout
 * with that colour on the button and the card edge, a readable text on the
 * button and a readable link colour on the card, derived by the same rules as
 * the website itself. A value that is not `#rrggbb` gives the platform's look.
 * The corner radius stays the platform's: it is the one thing mail clients
 * and a theme do not need to agree on.
 */
export function createEmailBrand(primary: string): EmailBrand {
  const channels = parseHexColor(primary);
  if (channels === null) {
    return { ...PLATFORM_EMAIL_BRAND, sender: 'website' };
  }
  const color = toHexColor(channels);
  return {
    ...PLATFORM_EMAIL_BRAND,
    sender: 'website',
    primary: color,
    primaryForeground: readableForeground(color),
    primaryCopy: readableCopy(color),
  };
}
