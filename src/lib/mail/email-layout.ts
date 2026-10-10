import { escapeHtml, isDefined } from '@lib/utils';

/**
 * Literal copies of the platform default theme in global.css.
 *
 * Email clients support neither CSS variables nor `color-mix()` nor web
 * fonts, so the tokens cannot be referenced and must be inlined as values.
 * Mails are sent from server code with no website context, so they always
 * use the platform default theme, never a per-website one.
 * Keep in sync with `:root` in global.css (the `--civo-*` names are noted
 * per entry).
 */
const EMAIL_TOKENS = {
  color: {
    canvas: '#f6f4ee', // --civo-color-background
    surface: '#ffffff', // --civo-color-surface
    copy: '#2e2a24', // --civo-color-text
    copyMuted: '#5b564c', // --civo-color-text-muted
    border: '#e4e0d5', // --civo-color-border
    primary: '#1f3a34', // --civo-color-primary
    primaryForeground: '#ffffff', // --civo-color-primary-foreground
    primaryCopy: '#1f3a34', // --civo-color-primary-copy
  },
  // Webfonts do not load in mail clients, so each stack ends in a safe
  // system font close to the real one (Source Serif -> Georgia).
  font: {
    heading: "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif", // --civo-font-heading
    body: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", // --civo-font-body
  },
  radius: '6px', // --civo-radius
} as const;

const T = EMAIL_TOKENS;

const PAGE_STYLE = `margin: 0; padding: 40px 20px; background-color: ${T.color.canvas}; font-family: ${T.font.body}; color: ${T.color.copy};`;

// Flat card: global.css defines no shadow token, so none is used here.
const CARD_STYLE = `max-width: 640px; margin: 0 auto; padding: 32px 24px; background-color: ${T.color.surface}; border: 1px solid ${T.color.border}; border-radius: ${T.radius}; font-family: ${T.font.body}; font-size: 15px; line-height: 1.6; color: ${T.color.copy};`;

const HEADING_STYLE = `margin: 0 0 24px 0; font-family: ${T.font.heading}; font-size: 22px; font-weight: 600; line-height: 1.3; color: ${T.color.copy};`;

const PARAGRAPH_STYLE = 'margin: 0 0 24px 0;';

const FACTS_STYLE = `margin: 0 0 24px 0; padding: 16px; border: 1px solid ${T.color.border}; border-radius: ${T.radius};`;

const FACT_LABEL_STYLE = `margin: 0; font-size: 13px; color: ${T.color.copyMuted};`;

const FACT_VALUE_STYLE = 'margin: 0 0 12px 0;';

const BUTTON_STYLE = `display: inline-block; padding: 12px 24px; background-color: ${T.color.primary}; color: ${T.color.primaryForeground}; border-radius: ${T.radius}; font-family: ${T.font.body}; font-size: 15px; font-weight: 500; text-decoration: none;`;

// Muted text on the surface; #5b564c is the token that meets 4.5:1 there.
const URL_FALLBACK_STYLE = `margin: 12px 0 0 0; font-size: 13px; word-break: break-all; color: ${T.color.copyMuted};`;

const URL_FALLBACK_LINK_STYLE = `color: ${T.color.primaryCopy};`;

const OUTRO_STYLE = `margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid ${T.color.border}; font-size: 14px; color: ${T.color.copyMuted};`;

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

function renderFacts(facts: readonly EmailFact[]): string {
  const rows = facts
    .map(
      (fact) =>
        `<p style="${FACT_LABEL_STYLE}">${escapeHtml(fact.label)}</p><p style="${FACT_VALUE_STYLE}">${escapeHtml(fact.value)}</p>`,
    )
    .join('');
  return `<div style="${FACTS_STYLE}">${rows}</div>`;
}

function renderAction(action: { readonly label: string; readonly url: string }): string {
  const url = escapeHtml(action.url);
  return `<div style="margin: 32px 0 0 0;"><a href="${url}" style="${BUTTON_STYLE}">${escapeHtml(action.label)}</a></div><p style="${URL_FALLBACK_STYLE}"><a href="${url}" style="${URL_FALLBACK_LINK_STYLE}">${url}</a></p>`;
}

/**
 * Renders one message as plain text and HTML in the platform's look. Every
 * dynamic value that reaches the HTML is escaped, so callers pass plain text.
 */
export function renderEmail(content: EmailContent): RenderedEmail {
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
    `<div style="${CARD_STYLE}">`,
    `<h2 style="${HEADING_STYLE}">${escapeHtml(title)}</h2>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(intro)}</p>`,
    facts.length > 0 ? renderFacts(facts) : null,
    action ? renderAction(action) : null,
    `<p style="${OUTRO_STYLE}">${escapeHtml(outro)}</p>`,
    '</div></body></html>',
  ]
    .filter(isDefined)
    .join('');

  return { subject: title, text, html };
}
