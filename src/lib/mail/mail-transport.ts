import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/** A fully rendered message. May contain single-use links: never log it. */
export interface OutboundMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * How bytes leave the building. Modules own their messages (copy, subject,
 * who gets what); this only delivers one. Swapping the provider (SMTP, SES,
 * Resend) means writing one class that implements this.
 */
export interface MailTransport {
  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError>;
}
