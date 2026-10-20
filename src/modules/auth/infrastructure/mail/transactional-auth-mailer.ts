import type { InfrastructureAppError } from '@lib/errors';
import type { MailTransport } from '@lib/mail';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from '../../domain/errors/auth-errors';

import { renderAuthEmail } from './auth-email-templates';

import type { AuthEmailKind, MailLocale } from './auth-email-templates';
import type { AuthLinkMessage, AuthMailer } from '../../domain/ports/auth-mailer.port';

export interface TransactionalAuthMailerSettings {
  readonly appName: string;
  /** The address a person opens to accept an invitation, in their language. Built by the composition root. */
  readonly invitationLink: (locale: MailLocale, token: string) => string;
  /** The sign-in page in a person's language, for the notice that an account already exists. */
  readonly signInLink: (locale: MailLocale) => string;
}

/** The real `AuthMailer`: renders the copy and hands it to a `MailTransport`. */
export class TransactionalAuthMailer implements AuthMailer {
  constructor(
    private readonly transport: MailTransport,
    private readonly settings: TransactionalAuthMailerSettings,
  ) {}

  sendVerification(message: AuthLinkMessage): AppResultAsync<void, InfrastructureAppError> {
    return this.send({ kind: 'verification', ...message });
  }

  sendPasswordReset(message: AuthLinkMessage): AppResultAsync<void, InfrastructureAppError> {
    return this.send({ kind: 'password_reset', ...message });
  }

  sendInvitation(message: {
    readonly to: string;
    readonly token: string;
    readonly locale: MailLocale;
  }): AppResultAsync<void, InfrastructureAppError> {
    return this.send({
      kind: 'invitation',
      to: message.to,
      locale: message.locale,
      url: this.settings.invitationLink(message.locale, message.token),
    });
  }

  sendExistingAccountNotice(message: {
    readonly to: string;
    readonly locale: MailLocale;
  }): AppResultAsync<void, InfrastructureAppError> {
    return this.send({
      kind: 'existing_account',
      url: this.settings.signInLink(message.locale),
      ...message,
    });
  }

  private send({
    kind,
    to,
    url,
    locale,
    name,
  }: {
    readonly kind: AuthEmailKind;
    readonly to: string;
    readonly url: string | null;
    readonly locale: MailLocale;
    readonly name?: string | undefined;
  }): AppResultAsync<void, InfrastructureAppError> {
    return this.transport
      .send({
        to,
        ...renderAuthEmail({
          kind,
          locale,
          appName: this.settings.appName,
          url,
          name,
        }),
      })
      .mapErr(mailDeliveryFailed);
  }
}
