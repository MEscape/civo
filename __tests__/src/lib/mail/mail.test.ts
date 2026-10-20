import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MailEnv } from '@lib/config/mail-env-schema';
import { createMailTransport } from '@lib/mail/create-mail-transport';
import { ResendMailTransport } from '@lib/mail/resend-mail-transport';
import { SmtpMailTransport } from '@lib/mail/smtp-mail-transport';

const BASE: MailEnv = {
  MAIL_PROVIDER: 'none',
  MAIL_API_URL: 'https://api.resend.com/emails',
  MAIL_SMTP_PORT: 1025,
  MAIL_SMTP_SECURE: false,
};

describe('createMailTransport', () => {
  it('sends nothing while no provider is chosen', () => {
    expect(createMailTransport(BASE)).toBeNull();
  });

  it('builds the SMTP transport from the settings', () => {
    const transport = createMailTransport({
      ...BASE,
      MAIL_PROVIDER: 'smtp',
      MAIL_SMTP_HOST: 'localhost',
      MAIL_FROM: 'Civo <no-reply@example.org>',
    });

    expect(transport).toBeInstanceOf(SmtpMailTransport);
  });

  it('builds the Resend transport from the settings', () => {
    const transport = createMailTransport({
      ...BASE,
      MAIL_PROVIDER: 'resend',
      MAIL_API_KEY: 're_key',
      MAIL_FROM: 'Civo <no-reply@example.org>',
    });

    expect(transport).toBeInstanceOf(ResendMailTransport);
  });
});

describe('sending a file along with a message', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands Resend the attachment as base64 text', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const transport = new ResendMailTransport({
      apiKey: 're_key',
      from: 'Civo <no-reply@example.org>',
      apiUrl: 'https://api.resend.com/emails',
    });

    const result = await transport.send({
      to: 'ada@example.org',
      subject: 'S',
      text: 'T',
      html: 'H',
      attachments: [
        { filename: 'a.ics', content: 'BEGIN:VCALENDAR', contentType: 'text/calendar' },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(result.isOk()).toBe(true);
    expect(JSON.parse(init.body).attachments).toEqual([
      {
        filename: 'a.ics',
        content: Buffer.from('BEGIN:VCALENDAR').toString('base64'),
        content_type: 'text/calendar',
      },
    ]);
  });
});
