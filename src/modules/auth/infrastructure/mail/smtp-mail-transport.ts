import nodemailer from 'nodemailer';

import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { InfrastructureAppError } from '@/lib/errors';

import { mailDeliveryFailed } from '../../domain/errors/auth-errors';

import type { MailTransport, OutboundMail } from './mail-transport';
import type { Transporter } from 'nodemailer';

export interface SmtpMailTransportOptions {
  /** SMTP server hostname, e.g. `localhost` for MailHog. */
  readonly host: string;
  /** SMTP server port, e.g. `1025` for MailHog. */
  readonly port: number;
  /** Sender address, e.g. `Civo <no-reply@example.org>`. */
  readonly from: string;
  /** Optional SMTP authentication username. */
  readonly user?: string;
  /** Optional SMTP authentication password. */
  readonly pass?: string;
  /** Whether to use TLS. Usually false for MailHog. */
  readonly secure?: boolean;
}

/**
 * Sends email through an SMTP server using Nodemailer.
 *
 * Supports optional SMTP authentication and is suitable for local
 * development with MailHog. Delivery failures are mapped to the shared
 * mail delivery error through `mailDeliveryFailed`.
 */
export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(options: SmtpMailTransportOptions) {
    this.from = options.from;

    const auth =
      options.user && options.pass ? { user: options.user, pass: options.pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
      auth,
    });
  }

  /**
   * Sends an outbound email and returns an asynchronous application result.
   *
   * Nodemailer errors are converted to the shared mail delivery error.
   * The result contains `undefined` on success.
   */
  send(mail: OutboundMail): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      await this.transporter.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    }, mailDeliveryFailed).andThen(() => okAsync(undefined));
  }
}
