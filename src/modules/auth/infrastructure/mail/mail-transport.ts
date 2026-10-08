import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/** A fully rendered message. Contains single-use links: never log it. */
export interface OutboundMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * How bytes leave the building. Internal to the mail adapter: the domain
 * only knows `AuthMailer`. Swapping the provider (SMTP, SES, Resend) means
 * writing one class that implements this.
 */
export interface MailTransport {
  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError>;
}
