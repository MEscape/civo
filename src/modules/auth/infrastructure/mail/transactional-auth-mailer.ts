import type { InfrastructureAppError } from '@lib/errors';
import type { MailTransport } from '@lib/mail';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from '../../domain/errors/auth-errors';

import { renderAuthEmail } from './auth-email-templates';

import type { MailLocale } from './auth-email-templates';
import type { AuthLinkMessage, AuthMailer } from '../../domain/ports/auth-mailer.port';

export interface TransactionalAuthMailerSettings {
  readonly appName: string;
  /** The address a person opens to accept an invitation, in their language. Built by the composition root. */
  readonly invitationLink: (locale: MailLocale, token: string) => string;
  /** The sign-in page in a person's language, for the notice that an account already exists. */
  readonly signInLink: (locale: MailLocale) => string;
}

type MailResult = AppResultAsync<void, InfrastructureAppError>;

/** Everything a template needs except the app name, which is this mailer's own setting. */
type OutgoingMail = Omit<Parameters<typeof renderAuthEmail>[0], 'appName'> & {
  readonly to: string;
};

/** The real `AuthMailer`: renders the copy and hands it to a `MailTransport`. */
export class TransactionalAuthMailer implements AuthMailer {
  constructor(
    private readonly transport: MailTransport,
    private readonly settings: TransactionalAuthMailerSettings,
  ) {}

  sendVerification(message: AuthLinkMessage): MailResult {
    return this.send({ kind: 'verification', ...message });
  }

  sendPasswordReset(message: AuthLinkMessage): MailResult {
    return this.send({ kind: 'password_reset', ...message });
  }

  sendInvitation({ token, ...message }: Parameters<AuthMailer['sendInvitation']>[0]): MailResult {
    return this.send({
      kind: 'invitation',
      ...message,
      url: this.settings.invitationLink(message.locale, token),
    });
  }

  sendExistingAccountNotice(
    message: Parameters<AuthMailer['sendExistingAccountNotice']>[0],
  ): MailResult {
    return this.send({
      kind: 'existing_account',
      ...message,
      url: this.settings.signInLink(message.locale),
    });
  }

  private send({ to, ...content }: OutgoingMail): MailResult {
    return this.transport
      .send({ to, ...renderAuthEmail({ ...content, appName: this.settings.appName }) })
      .mapErr(mailDeliveryFailed);
  }
}
