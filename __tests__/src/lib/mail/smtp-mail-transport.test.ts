import nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SmtpMailTransport } from '@lib/mail/smtp-mail-transport';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));

const SETTINGS = { host: 'smtp.example.org', port: 587, from: 'Civo <no-reply@example.org>' };
const MAIL = { to: 'jane.doe@example.org', subject: 'S', text: 'T', html: 'H' };

function connectionOptions(extra: { user?: string; pass?: string; secure?: boolean } = {}) {
  new SmtpMailTransport({ ...SETTINGS, ...extra });
  return vi.mocked(nodemailer.createTransport).mock.calls[0]?.[0];
}

beforeEach(() => {
  vi.mocked(nodemailer.createTransport).mockClear();
  sendMail.mockReset();
});

describe('SmtpMailTransport connection', () => {
  it('connects to the configured host and port', () => {
    expect(connectionOptions()).toMatchObject({ host: 'smtp.example.org', port: 587 });
  });

  it('bounds every phase of the connection', () => {
    expect(connectionOptions()).toMatchObject({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  });

  it('refuses to send credentials without STARTTLS', () => {
    expect(connectionOptions({ user: 'mailer', pass: 'secret' })).toMatchObject({
      requireTLS: true,
      auth: { user: 'mailer', pass: 'secret' },
    });
  });

  it('does not demand TLS from a local catcher that needs no credentials', () => {
    const options = connectionOptions();

    expect(options).toMatchObject({ requireTLS: false, secure: false });
    expect(options).toHaveProperty('auth', undefined);
  });

  it('uses TLS from the first byte when asked', () => {
    expect(connectionOptions({ secure: true })).toMatchObject({ secure: true });
  });

  it('sends no credentials unless both a user and a password are set', () => {
    expect(connectionOptions({ user: 'mailer' })).toHaveProperty('auth', undefined);
  });
});

describe('SmtpMailTransport.send', () => {
  const transport = () => new SmtpMailTransport(SETTINGS);

  it('hands the message to the server from the configured sender', async () => {
    sendMail.mockResolvedValue({});

    const result = await transport().send(MAIL);

    expect(result.isOk()).toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: SETTINGS.from,
      to: MAIL.to,
      subject: 'S',
      text: 'T',
      html: 'H',
      attachments: undefined,
    });
  });

  it('passes attachments as text with their media type', async () => {
    sendMail.mockResolvedValue({});

    await transport().send({
      ...MAIL,
      attachments: [
        { filename: 'a.ics', content: 'BEGIN:VCALENDAR', contentType: 'text/calendar' },
      ],
    });

    expect(sendMail.mock.calls[0]?.[0].attachments).toEqual([
      { filename: 'a.ics', content: 'BEGIN:VCALENDAR', contentType: 'text/calendar' },
    ]);
  });

  it('fails with the shared delivery error, naming the failure by its codes only', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('550 5.1.1 <jane.doe@example.org> user unknown'), {
        code: 'EENVELOPE',
        responseCode: 550,
        command: 'RCPT TO',
      }),
    );

    const error = (await transport().send(MAIL))._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: 'mail.delivery_failed',
      message: 'The email could not be delivered.',
    });
    expect((error.cause as Error).message).toBe('SMTP delivery failed EENVELOPE 550 RCPT TO');
    expect(JSON.stringify([error.message, (error.cause as Error).stack])).not.toContain('jane.doe');
  });

  it('copes with a failure that carries no codes, or is not an error object', async () => {
    sendMail.mockRejectedValueOnce(new Error('boom'));
    sendMail.mockRejectedValueOnce('a string');
    sendMail.mockRejectedValueOnce(null);

    const causes = [
      (await transport().send(MAIL))._unsafeUnwrapErr().cause,
      (await transport().send(MAIL))._unsafeUnwrapErr().cause,
      (await transport().send(MAIL))._unsafeUnwrapErr().cause,
    ] as Error[];

    expect(causes.map((cause) => cause.message)).toEqual([
      'SMTP delivery failed',
      'SMTP delivery failed',
      'SMTP delivery failed',
    ]);
  });
});
