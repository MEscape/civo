import nodemailer from 'nodemailer';

import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { mailDeliveryFailed } from './mail-errors';

import type { MailTransport, OutboundMail } from './mail-transport';
import type { Transporter } from 'nodemailer';

export interface SmtpMailTransportOptions {
  /** SMTP server hostname, e.g. `localhost` for Mailpit. */
  readonly host: string;
  /** SMTP server port, e.g. `1025` for Mailpit. */
  readonly port: number;
  /** Sender address, e.g. `Civo <no-reply@example.org>`. */
  readonly from: string;
  /** Optional SMTP authentication username. */
  readonly user?: string;
  /** Optional SMTP authentication password. */
  readonly pass?: string;
  /** Whether to use TLS. Usually false for a local catcher. */
  readonly secure?: boolean;
}

/**
 * Sends email through an SMTP server using Nodemailer. Supports optional
 * SMTP authentication and is suitable for local development with Mailpit.
 * Delivery failures are mapped to the shared `mailDeliveryFailed` error.
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
