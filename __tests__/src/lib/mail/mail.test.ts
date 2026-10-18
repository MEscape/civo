import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MailEnv } from '@lib/config/mail-env-schema';
import { PLATFORM_EMAIL_BRAND, createEmailBrand, renderEmail } from '@lib/mail';
import { createMailTransport } from '@lib/mail/create-mail-transport';
import { ResendMailTransport } from '@lib/mail/resend-mail-transport';
import { SmtpMailTransport } from '@lib/mail/smtp-mail-transport';

const BASE: MailEnv = {
  MAIL_PROVIDER: 'none',
  MAIL_API_URL: 'https://api.resend.com/emails',
  MAIL_SMTP_PORT: 1025,
  MAIL_SMTP_SECURE: false,
};

describe('renderEmail', () => {
  const content = {
    locale: 'en',
    title: 'Hello <Ada>',
    intro: 'Intro & more',
    facts: [{ label: 'When', value: 'Today <now>' }],
    action: { label: 'Open', url: 'https://example.org/?a=1&b=2' },
    outro: 'Bye',
  } as const;

  it('escapes every dynamic value in the HTML and keeps the text plain', () => {
    const mail = renderEmail(content);

    expect(mail.subject).toBe('Hello <Ada>');
    expect(mail.html).toContain('Hello &lt;Ada&gt;');
    expect(mail.html).toContain('Intro &amp; more');
    expect(mail.html).toContain('Today &lt;now&gt;');
    expect(mail.html).toContain('href="https://example.org/?a=1&amp;b=2"');
    expect(mail.text).toBe(
      'Intro & more\n\nWhen: Today <now>\n\nOpen: https://example.org/?a=1&b=2\n\nBye',
    );
  });

  it('leaves out the facts and the button when there are none', () => {
    const mail = renderEmail({ locale: 'de', title: 'T', intro: 'I', outro: 'O' });

    expect(mail.text).toBe('I\n\nO');
    expect(mail.html).toContain('<html lang="de">');
    expect(mail.html).not.toContain('<a ');
  });
});

describe('the layout of a message', () => {
  const content = {
    locale: 'en',
    title: 'Title',
    intro: 'The first line, shown beside the subject.',
    action: { label: 'Open', url: 'https://example.org/x', note: 'Valid for an hour.' },
    outro: 'Why you got this.',
  } as const;

  it('is built from tables, in one narrow column, and asks clients to leave its colours alone', () => {
    const { html } = renderEmail(content);

    expect(html).toContain('<table role="presentation"');
    expect(html).toContain('max-width: 560px');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain('<h1 ');
  });

  it('puts the first line of the message in the inbox preview, hidden in the body', () => {
    const { html } = renderEmail(content);

    expect(html).toMatch(/display: none;[^>]*>The first line, shown beside the subject\./u);
  });

  it('keeps the heading as the subject unless the subject says it better', () => {
    expect(renderEmail(content).subject).toBe('Title');
    expect(renderEmail({ ...content, subject: 'Title: which one' }).subject).toBe(
      'Title: which one',
    );
  });

  it('draws a button that holds its shape, a note beneath it and the link in words', () => {
    const { html, text } = renderEmail(content);

    expect(html).toContain('bgcolor="#1f3a34"');
    expect(html).toContain('Valid for an hour.');
    expect(html).toContain('Button not working? Open this link:');
    expect(text).toContain('Open: https://example.org/x\nValid for an hour.');
  });
});

describe('createEmailBrand', () => {
  it('takes the primary colour, with text that reads on it and as a link on the card', () => {
    const brand = createEmailBrand('#F5D000');

    expect(brand.primary).toBe('#f5d000');
    expect(brand.primaryForeground).toBe('#000000');
    expect(brand.primaryCopy).not.toBe('#f5d000');
    expect(brand.radius).toBe(PLATFORM_EMAIL_BRAND.radius);
  });

  it('puts the colour on the card edge and the button of the message', () => {
    const mail = renderEmail(
      {
        locale: 'en',
        title: 'T',
        intro: 'I',
        action: { label: 'Go', url: 'https://example.org' },
        outro: 'O',
      },
      createEmailBrand('#7a1f3d'),
    );

    expect(mail.html).toContain('border-top: 4px solid #7a1f3d');
    expect(mail.html).toContain('background-color: #7a1f3d');
  });

  it('looks like the platform when the colour is not a hex colour, but still speaks for the website', () => {
    expect(createEmailBrand('purple')).toEqual({ ...PLATFORM_EMAIL_BRAND, sender: 'website' });
  });

  it('carries the company logo in platform mail and only a credit line in website mail', () => {
    const content = { locale: 'de', title: 'Titel', intro: 'Hallo', outro: 'Gruß' };
    const platform = renderEmail(content);
    const website = renderEmail(content, createEmailBrand('#7a1f3d'));

    expect(platform.html).toContain('/email/artemis-connect.png');
    expect(platform.html).not.toContain('Bereitgestellt mit');
    expect(website.html).not.toContain('/email/artemis-connect.png');
    expect(website.html).toContain('Bereitgestellt mit Artemis Connect');
    expect(website.text).toContain('Bereitgestellt mit Artemis Connect');
  });
});

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
