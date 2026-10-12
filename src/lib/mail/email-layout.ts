import {
  escapeHtml,
  isDefined,
  parseHexColor,
  readableCopy,
  readableForeground,
  toHexColor,
} from '@lib/utils';

/**
 * The colours and corner radius a message takes from the website it speaks
 * for. Email clients support neither CSS variables nor `color-mix()`, so the
 * values are literal; a caller that knows a website passes that website's
 * theme here, everything else gets `PLATFORM_EMAIL_BRAND`.
 */
export interface EmailBrand {
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
    return PLATFORM_EMAIL_BRAND;
  }
  const color = toHexColor(channels);
  return {
    ...PLATFORM_EMAIL_BRAND,
    primary: color,
    primaryForeground: readableForeground(color),
    primaryCopy: readableCopy(color),
  };
}

/**
 * The neutrals and type of the page itself. A website theme does not change
 * them (see global.css), so they are not part of the brand.
 */
const EMAIL_TOKENS = {
  color: {
    canvas: '#f6f4ee', // --civo-color-background
    surface: '#ffffff', // --civo-color-surface
    copy: '#2e2a24', // --civo-color-text
    copyMuted: '#5b564c', // --civo-color-text-muted
    border: '#e4e0d5', // --civo-color-border
  },
  // Webfonts do not load in mail clients, so each stack ends in a safe
  // system font close to the real one (Source Serif -> Georgia).
  font: {
    heading: "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif", // --civo-font-heading
    body: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", // --civo-font-body
  },
} as const;

const T = EMAIL_TOKENS;

const PAGE_STYLE = `margin: 0; padding: 40px 20px; background-color: ${T.color.canvas}; font-family: ${T.font.body}; color: ${T.color.copy};`;

const HEADING_STYLE = `margin: 0 0 24px 0; font-family: ${T.font.heading}; font-size: 22px; font-weight: 600; line-height: 1.3; color: ${T.color.copy};`;

const PARAGRAPH_STYLE = 'margin: 0 0 24px 0;';

const FACT_LABEL_STYLE = `margin: 0; font-size: 13px; color: ${T.color.copyMuted};`;

const FACT_VALUE_STYLE = 'margin: 0 0 12px 0;';

// Muted text on the surface; #5b564c is the token that meets 4.5:1 there.
const URL_FALLBACK_STYLE = `margin: 12px 0 0 0; font-size: 13px; word-break: break-all; color: ${T.color.copyMuted};`;

const OUTRO_STYLE = `margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid ${T.color.border}; font-size: 14px; color: ${T.color.copyMuted};`;

// Flat card, with the brand colour as its top edge: a message without a button still looks like its sender.
// global.css defines no shadow token, so none is used here.
const cardStyle = (brand: EmailBrand) =>
  `max-width: 640px; margin: 0 auto; padding: 32px 24px; background-color: ${T.color.surface}; border: 1px solid ${T.color.border}; border-top: 4px solid ${brand.primary}; border-radius: ${brand.radius}; font-family: ${T.font.body}; font-size: 15px; line-height: 1.6; color: ${T.color.copy};`;

const factsStyle = (brand: EmailBrand) =>
  `margin: 0 0 24px 0; padding: 16px; border: 1px solid ${T.color.border}; border-radius: ${brand.radius};`;

const buttonStyle = (brand: EmailBrand) =>
  `display: inline-block; padding: 12px 24px; background-color: ${brand.primary}; color: ${brand.primaryForeground}; border-radius: ${brand.radius}; font-family: ${T.font.body}; font-size: 15px; font-weight: 500; text-decoration: none;`;

const urlFallbackLinkStyle = (brand: EmailBrand) => `color: ${brand.primaryCopy};`;

export interface EmailFact {
  readonly label: string;
  readonly value: string;
}

export interface EmailContent {
  /** The `lang` of the document: the language of every text below. */
  readonly locale: string;
  /** Subject line and heading. */
  readonly title: string;
  readonly intro: string;
  /** Labelled details, such as when and where. */
  readonly facts?: readonly EmailFact[];
  /** One button; its URL is also printed so a client that blocks buttons still works. */
  readonly action?: { readonly label: string; readonly url: string } | null;
  readonly outro: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function renderFacts(facts: readonly EmailFact[], brand: EmailBrand): string {
  const rows = facts
    .map(
      (fact) =>
        `<p style="${FACT_LABEL_STYLE}">${escapeHtml(fact.label)}</p><p style="${FACT_VALUE_STYLE}">${escapeHtml(fact.value)}</p>`,
    )
    .join('');
  return `<div style="${factsStyle(brand)}">${rows}</div>`;
}

function renderAction(
  action: { readonly label: string; readonly url: string },
  brand: EmailBrand,
): string {
  const url = escapeHtml(action.url);
  return `<div style="margin: 32px 0 0 0;"><a href="${url}" style="${buttonStyle(brand)}">${escapeHtml(action.label)}</a></div><p style="${URL_FALLBACK_STYLE}"><a href="${url}" style="${urlFallbackLinkStyle(brand)}">${url}</a></p>`;
}

/**
 * Renders one message as plain text and HTML. Every dynamic value that
 * reaches the HTML is escaped, so callers pass plain text. The look is the
 * platform's unless the caller passes the brand of the website it speaks for.
 */
export function renderEmail(
  content: EmailContent,
  brand: EmailBrand = PLATFORM_EMAIL_BRAND,
): RenderedEmail {
  const { locale, title, intro, facts = [], action = null, outro } = content;

  const text = [
    intro,
    facts.length > 0 ? facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n') : null,
    action ? `${action.label}: ${action.url}` : null,
    outro,
  ]
    .filter(isDefined)
    .join('\n\n');

  const html = [
    `<!doctype html><html lang="${escapeHtml(locale)}">`,
    // Without a charset, German umlauts can render as mojibake in some clients.
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>`,
    `<body style="${PAGE_STYLE}">`,
    `<div style="${cardStyle(brand)}">`,
    `<h2 style="${HEADING_STYLE}">${escapeHtml(title)}</h2>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(intro)}</p>`,
    facts.length > 0 ? renderFacts(facts, brand) : null,
    action ? renderAction(action, brand) : null,
    `<p style="${OUTRO_STYLE}">${escapeHtml(outro)}</p>`,
    '</div></body></html>',
  ]
    .filter(isDefined)
    .join('');

  return { subject: title, text, html };
}
