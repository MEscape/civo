import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mailDeliveryFailed, mailerNotConfigured } from '@modules/auth/domain/errors/auth-errors';
import { deliverAuthEmail } from '@modules/auth/infrastructure/better-auth/deliver-auth-email';

import { ResultAsync, errAsync, okAsync } from '@lib/result';

const deferred = vi.hoisted(() => ({ tasks: [] as Array<() => Promise<void>> }));
const error = vi.hoisted(() => vi.fn());

vi.mock('next/server', () => ({
  after: (task: () => Promise<void>) => deferred.tasks.push(task),
}));
vi.mock('@lib/logger', () => ({ logger: { withContext: () => ({ error }) } }));

async function finishResponse() {
  for (const task of deferred.tasks.splice(0)) {
    await task();
  }
}

describe('provider email delivery', () => {
  beforeEach(() => {
    deferred.tasks.length = 0;
    vi.clearAllMocks();
  });

  it('returns before starting delivery and sends after the response', async () => {
    const sent: string[] = [];
    await deliverAuthEmail(() => {
      sent.push('verification');
      return okAsync(undefined);
    }, 'verification');

    expect(sent).toEqual([]);
    await finishResponse();
    expect(sent).toEqual(['verification']);
    expect(error).not.toHaveBeenCalled();
  });

  it('returns while the transport is still pending', async () => {
    let complete: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });

    await deliverAuthEmail(() => ResultAsync.fromSafePromise(pending), 'password_reset');
    expect(deferred.tasks).toHaveLength(1);
    complete?.();
    await finishResponse();
  });

  it('reports typed failures once without logging recipients, links, or transport causes', async () => {
    const cause = new Error('550 victim@example.org https://example.org/reset?token=SECRET');
    await deliverAuthEmail(() => errAsync(mailDeliveryFailed(cause)), 'password_reset');
    await finishResponse();

    expect(error).toHaveBeenCalledExactlyOnceWith(
      'auth.email_delivery_failed',
      expect.objectContaining({ code: 'auth.mail_delivery_failed' }),
      { kind: 'password_reset' },
    );
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/victim|SECRET|550/);
  });

  it.each(['throw', 'reject'])(
    'contains an unexpected transport %s after the response',
    async (failure) => {
      await deliverAuthEmail(() => {
        if (failure === 'throw') {
          throw new Error('victim@example.org');
        }
        return ResultAsync.fromSafePromise(Promise.reject(new Error('victim@example.org')));
      }, 'existing_account');

      await expect(finishResponse()).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(error.mock.calls)).not.toContain('victim@example.org');
    },
  );

  it('keeps a configuration failure distinguishable without logging transport details', async () => {
    await deliverAuthEmail(() => errAsync(mailerNotConfigured()), 'verification');
    await finishResponse();
    expect(error).toHaveBeenCalledExactlyOnceWith(
      'auth.email_delivery_failed',
      { kind: 'infrastructure', code: 'auth.mailer_not_configured' },
      { kind: 'verification' },
    );
  });
});
