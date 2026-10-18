import { APP_IDENTITY } from '@lib/config';
import { escapeHtml, isDefined } from '@lib/utils';

import { PLATFORM_EMAIL_BRAND } from './email-brand';
import {
  COLUMN_STYLE,
  CREDIT_STYLE,
  HEADING_STYLE,
  OUTER_CELL_STYLE,
  OUTRO_STYLE,
  PAGE_STYLE,
  PARAGRAPH_STYLE,
  PRESENTATION_TABLE,
  cardStyle,
  creditLine,
  renderAction,
  renderFacts,
  renderLogo,
  renderPreheader,
} from './email-parts';
import { EMAIL_TOKENS } from './email-tokens';

import type { EmailBrand } from './email-brand';
import type { EmailAction, EmailFact } from './email-parts';

export { PLATFORM_EMAIL_BRAND, createEmailBrand } from './email-brand';
export type { EmailBrand } from './email-brand';
export type { EmailAction, EmailFact } from './email-parts';

export interface EmailContent {
  /** The `lang` of the document: the language of every text below. */
  readonly locale: string;
  /** The heading. Also the subject line, unless `subject` says it better. */
  readonly title: string;
  /** What the inbox lists: when the heading alone says too little ("Termin bestätigt: Passantrag, Di., 5. Jan."). */
  readonly subject?: string;
  /** "Hello Anna,": only when the message knows who it is for. */
  readonly greeting?: string;
  readonly intro: string;
  /** Labelled details, such as when and where. */
  readonly facts?: readonly EmailFact[];
  /** One button; its URL is also printed so a client that blocks buttons still works. */
  readonly action?: EmailAction | null;
  /** Why this was sent and what to do if it was not meant for the reader. */
  readonly outro: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function renderText(content: EmailContent, brand: EmailBrand): string {
  const { locale, greeting, intro, facts = [], action = null, outro } = content;
  return [
    greeting,
    intro,
    facts.length > 0 ? facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n') : null,
    action ? [`${action.label}: ${action.url}`, action.note].filter(isDefined).join('\n') : null,
    outro,
    brand.sender === 'website' ? creditLine(locale) : null,
  ]
    .filter(isDefined)
    .join('\n\n');
}

function renderCard(content: EmailContent, brand: EmailBrand): string {
  const { locale, title, greeting, intro, facts = [], action = null, outro } = content;
  const inner = [
    `<h1 style="${HEADING_STYLE}">${escapeHtml(title)}</h1>`,
    greeting ? `<p style="margin: 0 0 8px 0;">${escapeHtml(greeting)}</p>` : null,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(intro)}</p>`,
    facts.length > 0 ? renderFacts(facts, brand) : null,
    action ? renderAction(action, brand, locale) : null,
    `<p style="${OUTRO_STYLE}">${escapeHtml(outro)}</p>`,
  ]
    .filter(isDefined)
    .join('');
  return `<tr><td style="${cardStyle(brand)}">${inner}</td></tr>`;
}

function renderFooter(locale: string, brand: EmailBrand): string {
  const line =
    brand.sender === 'website'
      ? creditLine(locale)
      : `${APP_IDENTITY.name} · ${APP_IDENTITY.company}`;
  return `<tr><td align="center" style="${CREDIT_STYLE}">${escapeHtml(line)}</td></tr>`;
}

/**
 * Renders one message as plain text and HTML. Every dynamic value that
 * reaches the HTML is escaped, so callers pass plain text. The look is the
 * platform's unless the caller passes the brand of the website it speaks for.
 *
 * The HTML is built from tables, the one layout every mail client honours
 * (Outlook ignores the box model of a `div`), in a single 560px column that
 * simply narrows on a phone.
 */
export function renderEmail(
  content: EmailContent,
  brand: EmailBrand = PLATFORM_EMAIL_BRAND,
): RenderedEmail {
  const { locale, title, subject = title, intro } = content;

  const html = [
    `<!doctype html><html lang="${escapeHtml(locale)}">`,
    // Without a charset, German umlauts can render as mojibake in some clients.
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    // The look is made for a light page; clients that darken mail should leave it alone.
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`,
    `<title>${escapeHtml(subject)}</title></head>`,
    `<body style="${PAGE_STYLE}">`,
    renderPreheader(intro),
    `<table ${PRESENTATION_TABLE} width="100%" style="background-color: ${EMAIL_TOKENS.color.canvas};"><tr><td align="center" style="${OUTER_CELL_STYLE}">`,
    `<table ${PRESENTATION_TABLE} width="560" style="${COLUMN_STYLE}">`,
    brand.sender === 'platform' ? renderLogo() : null,
    renderCard(content, brand),
    renderFooter(locale, brand),
    '</table></td></tr></table>',
    '</body></html>',
  ]
    .filter(isDefined)
    .join('');

  return { subject, text: renderText(content, brand), html };
}
