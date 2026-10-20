import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MailEnv } from '@lib/config/mail-env-schema';
import { createMailTransport } from '@lib/mail/create-mail-transport';
import { MAIL_DELIVERY_FAILED, mailDeliveryFailed } from '@lib/mail/mail-errors';

const { getLocale, serverEnv } = vi.hoisted(() => ({
  getLocale: vi.fn(),
  serverEnv: { MAIL_PROVIDER: 'none' },
}));
vi.mock('server-only', () => ({}));
vi.mock('@i18n/server', () => ({ getLocale }));
vi.mock('@lib/config/server', () => ({ serverEnv }));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({})) } }));

const BASE: MailEnv = {
  MAIL_PROVIDER: 'none',
  MAIL_API_URL: 'https://api.resend.com/emails',
  MAIL_SMTP_PORT: 1025,
  MAIL_SMTP_SECURE: false,
};

describe('mailDeliveryFailed', () => {
  it('is the one stable error, generic to the user, with the detail as the cause', () => {
    const cause = new Error('provider detail');

    expect(mailDeliveryFailed(cause)).toEqual({
      kind: 'infrastructure',
      code: MAIL_DELIVERY_FAILED,
      message: 'The email could not be delivered.',
      cause,
    });
    expect(MAIL_DELIVERY_FAILED).toBe('mail.delivery_failed');
  });
});

describe('createMailTransport when the schema guarantees are bypassed', () => {
  it.each([
    [{ MAIL_PROVIDER: 'smtp', MAIL_SMTP_HOST: 'localhost' }, /MAIL_FROM is required/],
    [{ MAIL_PROVIDER: 'smtp', MAIL_FROM: 'a@example.org' }, /MAIL_SMTP_HOST is required/],
    [{ MAIL_PROVIDER: 'resend', MAIL_FROM: 'a@example.org' }, /MAIL_API_KEY is required/],
  ] as const)('fails fast for %j', (env, message) => {
    expect(() => createMailTransport({ ...BASE, ...env })).toThrow(message);
  });

  it('refuses a provider it does not know', () => {
    expect(() =>
      createMailTransport({
        ...BASE,
        MAIL_PROVIDER: 'carrier-pigeon',
        MAIL_FROM: 'a@b.c',
      } as never),
    ).toThrow('Unsupported MAIL_PROVIDER.');
  });
});

describe('resolveMailLocale', () => {
  beforeEach(() => {
    getLocale.mockReset();
  });

  it('follows the locale of the request', async () => {
    const { resolveMailLocale } = await import('@lib/mail/mail-locale');
    getLocale.mockResolvedValue('en');

    await expect(resolveMailLocale()).resolves.toBe('en');
  });

  it('falls back to the default for a locale that is not supported', async () => {
    const { resolveMailLocale } = await import('@lib/mail/mail-locale');
    const { I18N_CONFIG } = await import('@i18n');
    getLocale.mockResolvedValue('xx');

    await expect(resolveMailLocale()).resolves.toBe(I18N_CONFIG.defaultLocale);
  });

  it('falls back to the default outside a request, where reading the locale throws', async () => {
    const { resolveMailLocale } = await import('@lib/mail/mail-locale');
    const { I18N_CONFIG } = await import('@i18n');
    getLocale.mockRejectedValue(new Error('outside a request'));

    await expect(resolveMailLocale()).resolves.toBe(I18N_CONFIG.defaultLocale);
  });
});

describe('getMailTransport', () => {
  it('is null while no provider is chosen, built once', async () => {
    const { getMailTransport } = await import('@lib/mail/server');

    expect(getMailTransport()).toBeNull();
    expect(getMailTransport()).toBeNull();
  });

  it('exposes the request locale resolver', async () => {
    const server = await import('@lib/mail/server');
    const { resolveMailLocale } = await import('@lib/mail/mail-locale');

    expect(server.resolveMailLocale).toBe(resolveMailLocale);
  });
});
