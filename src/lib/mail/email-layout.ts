import { escapeHtml, invariant, isDefined, isValidUrl } from '@lib/utils';

import {
  creditLine,
  footerLine,
  renderAction,
  renderFacts,
  renderLogo,
  renderPreheader,
} from './email-blocks';
import { PLATFORM_EMAIL_BRAND } from './email-brand';
import { emailStyles } from './email-styles';

import type { EmailAction, EmailFact } from './email-blocks';
import type { EmailBrand } from './email-brand';

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

function renderCard(content: EmailContent, styles: ReturnType<typeof emailStyles>): string {
  const { locale, title, greeting, intro, facts = [], action = null, outro } = content;
  const inner = [
    `<h1 style="${styles.heading}">${escapeHtml(title)}</h1>`,
    greeting ? `<p style="${styles.greeting}">${escapeHtml(greeting)}</p>` : null,
    `<p style="${styles.paragraph}">${escapeHtml(intro)}</p>`,
    facts.length > 0 ? renderFacts(facts, styles) : null,
    action ? renderAction(action, styles, locale) : null,
    `<p style="${styles.outro}">${escapeHtml(outro)}</p>`,
  ]
    .filter(isDefined)
    .join('');
  return `<div style="${styles.card}">${inner}</div>`;
}

/**
 * Renders one message as plain text and HTML. Every dynamic value that reaches the HTML is
 * escaped, so callers pass plain text. The look is the platform's unless the caller passes the
 * brand of the website it speaks for.
 *
 * The HTML is semantic and styled inline, with no layout tables and none of the presentational
 * attributes (`bgcolor`, `align`, `cellpadding`, `width` on a cell): one centered column of at
 * most 560px that simply narrows on a phone. The only table is the facts, which are tabular data.
 * Current clients (Apple Mail, Gmail, Outlook on the web and the new Outlook, mobile apps) draw it
 * as designed; classic Outlook for Windows, which renders with Word, ignores `max-width` and
 * `border-radius` and shows the same content full width.
 *
 * @throws Error when the action's address is not an `http:` or `https:` URL: a link built by the
 *   application that is anything else is a bug, and a mail is no place to carry it
 */
export function renderEmail(
  content: EmailContent,
  brand: EmailBrand = PLATFORM_EMAIL_BRAND,
): RenderedEmail {
  const { locale, title, subject = title, intro, action } = content;
  if (action) {
    invariant(isValidUrl(action.url), 'An e-mail action links to an http(s) address.');
  }
  const styles = emailStyles(brand);

  const html = [
    `<!doctype html><html lang="${escapeHtml(locale)}">`,
    // Without a charset, German umlauts can render as mojibake in some clients.
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    // The look is made for a light page; clients that darken mail should leave it alone.
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`,
    `<title>${escapeHtml(subject)}</title></head>`,
    `<body style="${styles.page}">`,
    renderPreheader(intro, styles),
    `<div role="article" aria-roledescription="email" style="${styles.outer}">`,
    `<div style="${styles.column}">`,
    brand.sender === 'platform' ? renderLogo(styles) : null,
    renderCard(content, styles),
    `<p style="${styles.credit}">${escapeHtml(footerLine(brand, locale))}</p>`,
    '</div></div>',
    '</body></html>',
  ]
    .filter(isDefined)
    .join('');

  return { subject, text: renderText(content, brand), html };
}
