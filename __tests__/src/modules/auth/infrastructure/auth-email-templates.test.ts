import { describe, expect, it } from 'vitest';

import { renderAuthEmail } from '@modules/auth/infrastructure/mail/auth-email-templates';
import type { AuthEmailKind } from '@modules/auth/infrastructure/mail/auth-email-templates';

const KINDS: readonly AuthEmailKind[] = [
  'verification',
  'password_reset',
  'invitation',
  'existing_account',
];
const URL = 'https://civo.example/de/reset-password?token=abc';

const render = (kind: AuthEmailKind, locale: 'de' | 'en' = 'en') =>
  renderAuthEmail({ kind, locale, appName: 'Civo', url: URL });

describe('the authentication e-mails', () => {
  it.each(KINDS)('says in both languages what %s is and fills every placeholder', (kind) => {
    for (const locale of ['de', 'en'] as const) {
      const mail = render(kind, locale);

      expect(mail.subject).not.toMatch(/[{}]/u);
      expect(mail.text).not.toMatch(/[{}]/u);
      expect(mail.html).toContain(`lang="${locale}"`);
      expect(mail.html).toContain('Civo');
    }
  });

  it('carries a button with the link, and says how long it lasts, for every message that has one', () => {
    for (const kind of KINDS) {
      const mail = render(kind);

      expect(mail.html).toContain('href="https://civo.example/de/reset-password?token=abc"');
      expect(mail.text).toContain(URL);
    }
    expect(render('verification').text).toContain('valid for 60 minutes');
    expect(render('password_reset').text).toContain('valid for 60 minutes and can be used once');
    expect(render('invitation').text).toContain('valid for 7 days');
  });

  it('tells the owner of an existing account where to sign in, and that nothing changed', () => {
    const mail = renderAuthEmail({
      kind: 'existing_account',
      locale: 'en',
      appName: 'Civo',
      url: 'https://civo.example/en/sign-in',
    });

    expect(mail.text).toContain('nothing was changed');
    expect(mail.text).toContain('Go to sign in: https://civo.example/en/sign-in');
    expect(mail.text).toContain('reset it on the sign-in page');
  });

  it('sends no button when there is no link to put on it', () => {
    const mail = renderAuthEmail({
      kind: 'existing_account',
      locale: 'en',
      appName: 'Civo',
      url: null,
    });

    expect(mail.html).not.toContain('<a ');
  });

  it('always says what to do when the reader did not ask for it', () => {
    expect(render('password_reset').text).toContain('Was this not you?');
    expect(render('invitation', 'de').text).toContain('keine Einladung erwartet');
  });

  it('greets an account holder by the name on the account, and nobody else', () => {
    const base = { kind: 'password_reset', appName: 'Civo', url: URL } as const;

    expect(renderAuthEmail({ ...base, locale: 'en', name: ' Ada Lovelace ' }).text).toMatch(
      /^Hello Ada Lovelace,/u,
    );
    expect(renderAuthEmail({ ...base, locale: 'de', name: 'Ada' }).text).toMatch(/^Hallo Ada,/u);
    expect(renderAuthEmail({ ...base, locale: 'en' }).text).not.toMatch(/^Hello/u);
    expect(renderAuthEmail({ ...base, locale: 'en', name: '  ' }).text).not.toMatch(/^Hello/u);
  });
});
