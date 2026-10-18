import { APP_IDENTITY, publicEnv } from '@lib/config';
import { escapeHtml } from '@lib/utils';

import { EMAIL_TOKENS } from './email-tokens';

import type { EmailBrand } from './email-brand';

const T = EMAIL_TOKENS;

export interface EmailFact {
  readonly label: string;
  readonly value: string;
  /** `code` sets the value in a fixed-width face: a reference a person may read out or copy. */
  readonly style?: 'code';
}

export interface EmailAction {
  readonly label: string;
  readonly url: string;
  /** A quiet line under the button, such as how long the link lasts. */
  readonly note?: string;
}

/** A presentation table has no meaning of its own: clients and readers treat it as layout. */
const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

export const PAGE_STYLE = `margin: 0; padding: 0; background-color: ${T.color.canvas}; font-family: ${T.font.body}; color: ${T.color.copy};`;
export const OUTER_CELL_STYLE = 'padding: 40px 16px;';
export const COLUMN_STYLE = 'width: 100%; max-width: 560px; border-collapse: separate;';

/** Flat card with the brand colour as its top edge: a message without a button still looks like its sender. */
export const cardStyle = (brand: EmailBrand) =>
  `padding: 32px; background-color: ${T.color.surface}; border: 1px solid ${T.color.border}; border-top: 4px solid ${brand.primary}; border-radius: ${brand.radius}; font-family: ${T.font.body}; font-size: 15px; line-height: 1.6; color: ${T.color.copy};`;

export const HEADING_STYLE = `margin: 0 0 16px 0; font-family: ${T.font.heading}; font-size: 24px; font-weight: 600; line-height: 1.3; color: ${T.color.copy};`;
export const PARAGRAPH_STYLE = 'margin: 0 0 24px 0;';
export const OUTRO_STYLE = `margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid ${T.color.border}; font-size: 14px; color: ${T.color.copyMuted};`;
export const CREDIT_STYLE = `padding: 20px 0 0 0; text-align: center; font-size: 12px; color: ${T.color.copyMuted};`;

/** Hidden text that mail clients show beside the subject: the first line of the message, not "View in browser". */
const PREHEADER_STYLE =
  'display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all; font-size: 1px; line-height: 1px; color: transparent;';
const PREHEADER_LENGTH = 110;
/** Pushes the body's own text out of the preview line that follows the hidden one. */
const PREHEADER_FILL = '&zwnj;&nbsp;'.repeat(40);

export function renderPreheader(text: string): string {
  return `<div style="${PREHEADER_STYLE}">${escapeHtml(text.slice(0, PREHEADER_LENGTH))}${PREHEADER_FILL}</div>`;
}

/**
 * The company logo as a PNG on the app's own address: mail clients block SVG
 * and inline images are often stripped, a hosted image is what they show.
 * Twice the drawn size, for sharp screens.
 */
const LOGO = { path: '/email/artemis-connect.png', width: 120, height: 81 } as const;
const LOGO_STYLE =
  'display: inline-block; border: 0; outline: none; text-decoration: none; height: auto;';

export function renderLogo(): string {
  const src = escapeHtml(`${publicEnv.NEXT_PUBLIC_APP_URL}${LOGO.path}`);
  return `<tr><td align="center" style="padding: 0 0 24px 0;"><img src="${src}" width="${LOGO.width}" height="${LOGO.height}" alt="${escapeHtml(APP_IDENTITY.company)}" style="${LOGO_STYLE}"></td></tr>`;
}

/** The credit under a website's mail, by language; a language without one gets the default's. */
const PROVIDED_WITH: Readonly<Record<string, string>> = {
  de: 'Bereitgestellt mit',
  en: 'Provided with',
};

export function creditLine(locale: string): string {
  return `${PROVIDED_WITH[locale] ?? PROVIDED_WITH['de']} ${APP_IDENTITY.company}`;
}

/** Said above the printed link, for a client that blocks buttons. */
const LINK_HINT: Readonly<Record<string, string>> = {
  de: 'Funktioniert die Schaltfläche nicht? Öffnen Sie diesen Link:',
  en: 'Button not working? Open this link:',
};

const FACT_CELL = 'padding: 12px 16px; font-size: 14px; line-height: 1.5; vertical-align: top;';

/** The details as label and value side by side, in a tinted box with rules between the rows. */
export function renderFacts(facts: readonly EmailFact[], brand: EmailBrand): string {
  const rows = facts
    .map((fact, index) => {
      const rule = index === 0 ? '' : ` border-top: 1px solid ${T.color.border};`;
      const value =
        fact.style === 'code'
          ? `font-family: ${T.font.mono}; font-weight: 600; letter-spacing: 0.04em;`
          : '';
      return `<tr><td width="32%" style="${FACT_CELL} color: ${T.color.copyMuted};${rule}">${escapeHtml(fact.label)}</td><td style="${FACT_CELL} color: ${T.color.copy};${rule}${value}">${escapeHtml(fact.value)}</td></tr>`;
    })
    .join('');
  return `<table ${TABLE} width="100%" style="margin: 0 0 24px 0; background-color: ${T.color.canvas}; border: 1px solid ${T.color.border}; border-radius: ${brand.radius}; border-collapse: separate;">${rows}</table>`;
}

/** A button that holds its shape in every client (the padding is on the cell, not the link), a note, and the link in words. */
export function renderAction(action: EmailAction, brand: EmailBrand, locale: string): string {
  const url = escapeHtml(action.url);
  const hint = escapeHtml(LINK_HINT[locale] ?? LINK_HINT['de'] ?? '');
  const note =
    action.note === undefined
      ? ''
      : `<p style="margin: 12px 0 0 0; font-size: 13px; color: ${T.color.copyMuted};">${escapeHtml(action.note)}</p>`;
  const button = `<table ${TABLE} style="margin: 8px 0 0 0;"><tr><td align="center" bgcolor="${brand.primary}" style="background-color: ${brand.primary}; border-radius: ${brand.radius};"><a href="${url}" style="display: inline-block; padding: 13px 28px; font-family: ${T.font.body}; font-size: 15px; font-weight: 600; line-height: 1.2; color: ${brand.primaryForeground}; text-decoration: none; border-radius: ${brand.radius};">${escapeHtml(action.label)}</a></td></tr></table>`;
  const fallback = `<p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: ${T.color.copyMuted};">${hint}<br><a href="${url}" style="color: ${brand.primaryCopy}; word-break: break-all;">${url}</a></p>`;
  return `${button}${note}${fallback}`;
}

export { TABLE as PRESENTATION_TABLE };
