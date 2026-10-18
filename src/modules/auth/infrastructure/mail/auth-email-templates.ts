import { renderEmail } from '@lib/mail';
import type { RenderedEmail } from '@lib/mail';

import { AUTH_LINK_LIFETIME_SECONDS } from '../../domain/models/credentials';
import { INVITATION_LIFETIME_MS } from '../../domain/models/invitation';

import type { MailLocale } from '../../domain/ports/auth-mailer.port';

export type { MailLocale };
export type AuthEmailKind = 'verification' | 'password_reset' | 'existing_account' | 'invitation';

interface EmailCopy {
  readonly subject: string;
  readonly intro: string;
  /** Null when the message carries no link. */
  readonly actionLabel: string | null;
  /** Under the button: how long the link lasts, or where else to go. */
  readonly note: string | null;
  /** Why this arrived and what to do when it was not meant for the reader. */
  readonly outro: string;
}

const SECONDS_PER_MINUTE = 60;
const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;
const MS_PER_DAY = 86_400_000;
const INVITATION_LIFETIME_DAYS = INVITATION_LIFETIME_MS / MS_PER_DAY;

/**
 * Email copy lives in the adapter, not in the app's translation files
 * (auth-mailer.port.ts): there is no request locale when a mail is sent
 * from a provider hook, so the locale is configuration.
 * `{appName}`, `{minutes}` and `{days}` are the only placeholders.
 */
/** `{name}` is the name on the account; a message to someone without one has no greeting. */
const GREETING: Record<MailLocale, string> = { de: 'Hallo {name},', en: 'Hello {name},' };

const COPY: Record<MailLocale, Record<AuthEmailKind, EmailCopy>> = {
  de: {
    verification: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      intro:
        'Willkommen bei {appName}! Bitte bestätigen Sie Ihre E-Mail-Adresse, damit wir Ihr Konto aktivieren können.',
      actionLabel: 'E-Mail-Adresse bestätigen',
      note: 'Der Link ist {minutes} Minuten gültig.',
      outro:
        'Sie haben kein Konto angelegt? Dann können Sie diese Nachricht ignorieren; es passiert nichts.',
    },
    password_reset: {
      subject: 'Passwort zurücksetzen',
      intro:
        'Für Ihr Konto bei {appName} wurde das Zurücksetzen des Passworts angefordert. Wählen Sie mit dem Button ein neues Passwort.',
      actionLabel: 'Neues Passwort festlegen',
      note: 'Der Link ist {minutes} Minuten gültig und kann nur einmal verwendet werden.',
      outro: 'Das waren nicht Sie? Dann ist keine Aktion nötig; Ihr Passwort bleibt unverändert.',
    },
    invitation: {
      subject: 'Einladung zu {appName}',
      intro:
        'Sie wurden eingeladen, bei {appName} mitzuarbeiten. Legen Sie mit dem Button Ihren Namen und Ihr Passwort fest, dann können Sie sofort loslegen.',
      actionLabel: 'Einladung annehmen',
      note: 'Der Link ist {days} Tage gültig und kann nur einmal verwendet werden.',
      outro: 'Sie haben keine Einladung erwartet? Dann können Sie diese Nachricht ignorieren.',
    },
    existing_account: {
      subject: 'Registrierungsversuch mit Ihrer E-Mail-Adresse',
      intro:
        'Jemand hat versucht, mit dieser E-Mail-Adresse ein Konto bei {appName} anzulegen. Es besteht bereits ein Konto, deshalb wurde nichts geändert.',
      actionLabel: 'Zur Anmeldung',
      note: 'Passwort vergessen? Auf der Anmeldeseite können Sie es zurücksetzen.',
      outro:
        'Waren Sie das nicht, ist keine Aktion nötig; Ihr Konto und Ihr Passwort sind unverändert.',
    },
  },
  en: {
    verification: {
      subject: 'Verify your email address',
      intro:
        'Welcome to {appName}! Please verify your email address so we can activate your account.',
      actionLabel: 'Verify email address',
      note: 'The link is valid for {minutes} minutes.',
      outro:
        'Did you not create an account? Then you can ignore this message; nothing will happen.',
    },
    password_reset: {
      subject: 'Reset your password',
      intro:
        'A password reset was requested for your {appName} account. Use the button to choose a new password.',
      actionLabel: 'Choose a new password',
      note: 'The link is valid for {minutes} minutes and can be used once.',
      outro: 'Was this not you? Then no action is needed; your password stays unchanged.',
    },
    invitation: {
      subject: 'Invitation to {appName}',
      intro:
        'You have been invited to work with {appName}. Use the button to choose your name and password, then you can get started right away.',
      actionLabel: 'Accept invitation',
      note: 'The link is valid for {days} days and can be used once.',
      outro: 'Were you not expecting an invitation? Then you can ignore this message.',
    },
    existing_account: {
      subject: 'Sign-up attempt with your email address',
      intro:
        'Someone tried to create an {appName} account with this email address. An account already exists, so nothing was changed.',
      actionLabel: 'Go to sign in',
      note: 'Forgot your password? You can reset it on the sign-in page.',
      outro: 'If this was not you, no action is needed; your account and password are unchanged.',
    },
  },
} as const satisfies Record<MailLocale, Record<AuthEmailKind, EmailCopy>>;

function interpolate(template: string, appName: string): string {
  return template
    .replaceAll('{appName}', appName)
    .replaceAll('{minutes}', String(LINK_LIFETIME_MINUTES))
    .replaceAll('{days}', String(INVITATION_LIFETIME_DAYS));
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
  /** The name on the account, when the message is for an account holder. */
  readonly name?: string | null | undefined;
}): RenderedEmail {
  const copy: EmailCopy = COPY[input.locale][input.kind];
  const name = input.name?.trim() ?? '';

  return renderEmail({
    locale: input.locale,
    title: interpolate(copy.subject, input.appName),
    ...(name === '' ? {} : { greeting: GREETING[input.locale].replace('{name}', name) }),
    intro: interpolate(copy.intro, input.appName),
    action:
      copy.actionLabel !== null && input.url !== null
        ? {
            label: copy.actionLabel,
            url: input.url,
            ...(copy.note === null ? {} : { note: interpolate(copy.note, input.appName) }),
          }
        : null,
    outro: interpolate(copy.outro, input.appName),
  });
}
