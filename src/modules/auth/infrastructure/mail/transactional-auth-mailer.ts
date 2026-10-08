import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { renderAuthEmail } from './auth-email-templates';

import type { AuthEmailKind, MailLocale } from './auth-email-templates';
import type { MailTransport } from './mail-transport';
import type { AuthLinkMessage, AuthMailer } from '../../domain/ports/auth-mailer.port';

export interface TransactionalAuthMailerSettings {
  readonly appName: string;
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

  sendExistingAccountNotice(message: {
    readonly to: string;
    readonly locale: MailLocale;
  }): AppResultAsync<void, InfrastructureAppError> {
    return this.send({ kind: 'existing_account', url: null, ...message });
  }

  private send({
    kind,
    to,
    url,
    locale,
  }: {
    readonly kind: AuthEmailKind;
    readonly to: string;
    readonly url: string | null;
    readonly locale: MailLocale;
  }): AppResultAsync<void, InfrastructureAppError> {
    return this.transport.send({
      to,
      ...renderAuthEmail({
        kind,
        locale,
        appName: this.settings.appName,
        url,
      }),
    });
  }
}
