import { renderEmail } from '@lib/mail';
import type { RenderedEmail } from '@lib/mail';

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

function interpolate(template: string, appName: string): string {
  return template
    .replaceAll('{appName}', appName)
    .replaceAll('{minutes}', String(LINK_LIFETIME_MINUTES));
}

/**
 * Renders one message as plain text and HTML in the platform's look. The
 * layout and its escaping are shared (`@lib/mail`); only the words are here.
 */
export function renderAuthEmail(input: {
  readonly kind: AuthEmailKind;
  readonly locale: MailLocale;
  readonly appName: string;
  readonly url: string | null;
}): RenderedEmail {
  const copy: EmailCopy = COPY[input.locale][input.kind];

  return renderEmail({
    locale: input.locale,
    title: copy.subject,
    intro: interpolate(copy.intro, input.appName),
    action:
      copy.actionLabel !== null && input.url !== null
        ? { label: copy.actionLabel, url: input.url }
        : null,
    outro: interpolate(copy.outro, input.appName),
  });
}
