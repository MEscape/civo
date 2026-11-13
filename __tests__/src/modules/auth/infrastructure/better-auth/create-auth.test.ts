import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthMailer } from '@modules/auth/domain/ports/auth-mailer.port';
import { createAuth } from '@modules/auth/infrastructure/better-auth/create-auth';

import { I18N_CONFIG } from '@i18n';

import { okAsync } from '@lib/result';

const tasks = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => tasks.push(task) }));
vi.mock('@lib/mail/server', () => ({ resolveMailLocale: async () => 'en' }));

const user = {
  id: 'person',
  email: 'ada@example.org',
  emailVerified: false,
  name: 'Ada',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('Better Auth mail callback wiring', () => {
  // Better Auth connects to the pool as soon as it is created. These tests never need a database, so
  // the pool points at a socket that does not exist and fails at once, instead of reaching whatever
  // listens on localhost:5432 (and making `pool.end()` wait for that connection under load).
  const pool = new Pool({ host: '/nonexistent-postgres-socket' });
  const mailer = {
    sendVerification: vi.fn<AuthMailer['sendVerification']>(),
    sendPasswordReset: vi.fn<AuthMailer['sendPasswordReset']>(),
    sendExistingAccountNotice: vi.fn<AuthMailer['sendExistingAccountNotice']>(),
    sendInvitation: vi.fn<AuthMailer['sendInvitation']>(),
  };
  const auth = createAuth(
    {
      baseUrl: 'https://example.org',
      secret: 'x'.repeat(40),
      isProduction: true,
      trustedProxies: [],
      session: { expiresInSeconds: 3600, updateAgeSeconds: 1800, freshAgeSeconds: 900 },
    },
    { pool, mailer, audit: { record: () => undefined } },
  );

  beforeEach(() => {
    tasks.length = 0;
    vi.clearAllMocks();
    for (const send of Object.values(mailer)) {
      send.mockReturnValue(okAsync(undefined));
    }
  });
  afterAll(async () => {
    await pool.end();
  });

  it('defers every provider mail while retaining link, recipient, name, and locale policies', async () => {
    const link = { user, url: 'https://example.org/link?token=SECRET', token: 'SECRET' };
    await auth.options.emailAndPassword.sendResetPassword(link);
    await auth.options.emailVerification.sendVerificationEmail(link);
    await auth.options.emailAndPassword.onExistingUserSignUp({ user });

    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
    expect(mailer.sendVerification).not.toHaveBeenCalled();
    expect(mailer.sendExistingAccountNotice).not.toHaveBeenCalled();

    for (const task of tasks.splice(0)) {
      await task();
    }
    const expectedLink = { to: user.email, url: link.url, name: user.name, locale: 'en' };
    expect(mailer.sendPasswordReset).toHaveBeenCalledWith(expectedLink);
    expect(mailer.sendVerification).toHaveBeenCalledWith(expectedLink);
    expect(mailer.sendExistingAccountNotice).toHaveBeenCalledWith({
      to: user.email,
      locale: I18N_CONFIG.defaultLocale,
    });
    expect(mailer.sendInvitation).not.toHaveBeenCalled();
  });
});
