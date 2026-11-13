import { renderEmail } from '@lib/mail';
import type { RenderedEmail } from '@lib/mail';
import { MS_PER_DAY, SECONDS_PER_MINUTE, isDefined } from '@lib/utils';

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

/** Labels of the line that tells an invitee who invited them and to what. */
interface InvitationContext {
  readonly inviter: string;
  readonly website: string;
  readonly platform: string;
  /** The inviter's name when the invitation came from the system itself. */
  readonly system: string;
}

const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;
const INVITATION_LIFETIME_DAYS = INVITATION_LIFETIME_MS / MS_PER_DAY;

/** `{name}` is the name on the account; a message to someone without one has no greeting. */
const GREETING: Record<MailLocale, string> = { de: 'Hallo {name},', en: 'Hello {name},' };

const INVITATION_CONTEXT: Record<MailLocale, InvitationContext> = {
  en: {
    inviter: 'Invited by',
    website: 'Website',
    platform: 'Platform administration',
    system: 'Platform',
  },
  de: {
    inviter: 'Eingeladen von',
    website: 'Website',
    platform: 'Plattformverwaltung',
    system: 'Plattform',
  },
};

/**
 * Email copy lives in the adapter, not in the app's translation files
 * (auth-mailer.port.ts): there is no request locale when a mail is sent
 * from a provider hook, so the locale is configuration.
 * `{appName}`, `{minutes}` and `{days}` are the only placeholders.
 */
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
        'Sie wurden zu {appName} eingeladen. Öffnen Sie die Einladung, prüfen Sie den Zugriff und nehmen Sie ihn mit Ihrem Konto an. Erstellen Sie bei Bedarf zuerst ein Konto.',
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
        'You have been invited to {appName}. Open the invitation to review the access and accept it with your account. Create an account first if needed.',
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
};

/** Replacements are functions so a `$` in a value is never read as a replacement pattern. */
function interpolate(template: string, appName: string): string {
  return template
    .replaceAll('{appName}', () => appName)
    .replaceAll('{minutes}', String(LINK_LIFETIME_MINUTES))
    .replaceAll('{days}', String(INVITATION_LIFETIME_DAYS));
}

/**
 * Says who invited the reader and to what, ahead of the copy. The names come from people, so this runs
 * after the copy's placeholders are filled: a name that contains `{appName}` stays as it was typed.
 * No website means the invitation is to the platform itself.
 */
function withInvitationContext(
  locale: MailLocale,
  intro: string,
  {
    inviterName,
    websiteName,
  }: Pick<Parameters<typeof renderAuthEmail>[0], 'inviterName' | 'websiteName'>,
): string {
  const labels = INVITATION_CONTEXT[locale];
  const scope = isDefined(websiteName) ? `${labels.website}: ${websiteName}` : labels.platform;
  return `${labels.inviter}: ${inviterName ?? labels.system}. ${scope}. ${intro}`;
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
  readonly inviterName?: string | null | undefined;
  readonly websiteName?: string | null | undefined;
}): RenderedEmail {
  const copy = COPY[input.locale][input.kind];
  const name = input.name?.trim() ?? '';
  const intro = interpolate(copy.intro, input.appName);

  return renderEmail({
    locale: input.locale,
    title: interpolate(copy.subject, input.appName),
    ...(name === '' ? {} : { greeting: GREETING[input.locale].replace('{name}', () => name) }),
    intro: input.kind === 'invitation' ? withInvitationContext(input.locale, intro, input) : intro,
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
