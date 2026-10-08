import { escapeHtml, isDefined } from '@lib/utils';

import { AUTH_LINK_LIFETIME_SECONDS } from '../../domain/models/credentials';

import type { MailLocale } from '../../domain/ports/auth-mailer.port';

export type { MailLocale };
export type AuthEmailKind = 'verification' | 'password_reset' | 'existing_account';

interface EmailCopy {
  readonly subject: string;
  readonly intro: string;
  /** Null when the message carries no link. */
  readonly actionLabel: string | null;
  readonly outro: string;
}

const SECONDS_PER_MINUTE = 60;
const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;

/**
 * Email copy lives in the adapter, not in the app's translation files
 * (auth-mailer.port.ts): there is no request locale when a mail is sent
 * from a provider hook, so the locale is configuration.
 * `{appName}` and `{minutes}` are the only placeholders.
 */
const COPY: Record<MailLocale, Record<AuthEmailKind, EmailCopy>> = {
  de: {
    verification: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      intro: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto bei {appName} zu aktivieren.',
      actionLabel: 'E-Mail-Adresse bestätigen',
      outro:
        'Der Link ist {minutes} Minuten gültig. Wenn Sie kein Konto angelegt haben, können Sie diese Nachricht ignorieren.',
    },
    password_reset: {
      subject: 'Passwort zurücksetzen',
      intro: 'Für Ihr Konto bei {appName} wurde das Zurücksetzen des Passworts angefordert.',
      actionLabel: 'Neues Passwort festlegen',
      outro:
        'Der Link ist {minutes} Minuten gültig. Wenn Sie das nicht angefordert haben, ist keine Aktion nötig; Ihr Passwort bleibt unverändert.',
    },
    existing_account: {
      subject: 'Registrierungsversuch mit Ihrer E-Mail-Adresse',
      intro:
        'Jemand hat versucht, mit dieser E-Mail-Adresse ein Konto bei {appName} anzulegen. Es besteht bereits ein Konto.',
      actionLabel: null,
      outro:
        'Waren Sie das, melden Sie sich an oder setzen Sie Ihr Passwort zurück. Andernfalls ist keine Aktion nötig.',
    },
  },
  en: {
    verification: {
      subject: 'Verify your email address',
      intro: 'Please verify your email address to activate your {appName} account.',
      actionLabel: 'Verify email address',
      outro:
        'The link is valid for {minutes} minutes. If you did not create an account, you can ignore this message.',
    },
    password_reset: {
      subject: 'Reset your password',
      intro: 'A password reset was requested for your {appName} account.',
      actionLabel: 'Choose a new password',
      outro:
        'The link is valid for {minutes} minutes. If you did not request this, no action is needed; your password stays unchanged.',
    },
    existing_account: {
      subject: 'Sign-up attempt with your email address',
      intro:
        'Someone tried to create an {appName} account with this email address. An account already exists.',
      actionLabel: null,
      outro: 'If this was you, sign in or reset your password. Otherwise no action is needed.',
    },
  },
} as const satisfies Record<MailLocale, Record<AuthEmailKind, EmailCopy>>;

/**
 * Literal copies of the platform default theme in global.css.
 *
 * Email clients support neither CSS variables nor `color-mix()` nor web
 * fonts, so the tokens cannot be referenced and must be inlined as values.
 * Mails are sent from provider hooks with no website context, so they
 * always use the platform default theme, never a per-website one.
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

const BUTTON_STYLE = `display: inline-block; padding: 12px 24px; background-color: ${T.color.primary}; color: ${T.color.primaryForeground}; border-radius: ${T.radius}; font-family: ${T.font.body}; font-size: 15px; font-weight: 500; text-decoration: none;`;

// Muted text on the surface; #5b564c is the token that meets 4.5:1 there.
const URL_FALLBACK_STYLE = `margin: 12px 0 0 0; font-size: 13px; word-break: break-all; color: ${T.color.copyMuted};`;

const URL_FALLBACK_LINK_STYLE = `color: ${T.color.primaryCopy};`;

const OUTRO_STYLE = `margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid ${T.color.border}; font-size: 14px; color: ${T.color.copyMuted};`;

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function interpolate(template: string, appName: string): string {
  return template
    .replaceAll('{appName}', appName)
    .replaceAll('{minutes}', String(LINK_LIFETIME_MINUTES));
}

/**
 * Renders one message as plain text and HTML. Every dynamic value that
 * reaches the HTML is escaped; the link is the provider's own URL.
 */
export function renderAuthEmail(input: {
  readonly kind: AuthEmailKind;
  readonly locale: MailLocale;
  readonly appName: string;
  readonly url: string | null;
}): RenderedEmail {
  const copy: EmailCopy = COPY[input.locale][input.kind];
  const intro = interpolate(copy.intro, input.appName);
  const outro = interpolate(copy.outro, input.appName);
  const link =
    copy.actionLabel !== null && input.url !== null
      ? { label: copy.actionLabel, url: input.url }
      : null;

  const text = [intro, link ? `${link.label}: ${link.url}` : null, outro]
    .filter(isDefined)
    .join('\n\n');

  const html = [
    `<!doctype html><html lang="${input.locale}">`,
    // Without a charset, German umlauts can render as mojibake in some clients.
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>`,
    `<body style="${PAGE_STYLE}">`,
    `<div style="${CARD_STYLE}">`,
    `<h2 style="${HEADING_STYLE}">${escapeHtml(copy.subject)}</h2>`,
    `<p style="${PARAGRAPH_STYLE}">${escapeHtml(intro)}</p>`,
    link
      ? `<div style="margin: 32px 0 0 0;"><a href="${escapeHtml(link.url)}" style="${BUTTON_STYLE}">${escapeHtml(link.label)}</a></div><p style="${URL_FALLBACK_STYLE}"><a href="${escapeHtml(link.url)}" style="${URL_FALLBACK_LINK_STYLE}">${escapeHtml(link.url)}</a></p>`
      : null,
    `<p style="${OUTRO_STYLE}">${escapeHtml(outro)}</p>`,
    '</div></body></html>',
  ]
    .filter(isDefined)
    .join('');

  return { subject: copy.subject, text, html };
}
