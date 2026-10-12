import { describe, expect, it } from 'vitest';

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

  it('looks like the platform when the colour is not a hex colour', () => {
    expect(createEmailBrand('purple')).toEqual(PLATFORM_EMAIL_BRAND);
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
