import { describe, expect, it, vi } from 'vitest';

import { AUTH_ERROR_CODES } from '@modules/auth/domain/errors/auth-errors';
import { TransactionalAuthMailer } from '@modules/auth/infrastructure/mail/transactional-auth-mailer';

import { mailDeliveryFailed as transportFailure } from '@lib/mail';
import type { MailTransport, OutboundMail } from '@lib/mail';
import { errAsync, okAsync } from '@lib/result';

const SETTINGS = {
  appName: 'Civo',
  invitationLink: (locale: string, token: string) =>
    `https://civo.example/${locale}/invitation?token=${token}`,
  signInLink: (locale: string) => `https://civo.example/${locale}/sign-in`,
};

function mailer(send: MailTransport['send']) {
  return new TransactionalAuthMailer({ send }, SETTINGS);
}

describe('TransactionalAuthMailer', () => {
  it('renders each kind of message and hands it to the transport', async () => {
    const sent: OutboundMail[] = [];
    const send = vi.fn((mail: OutboundMail) => {
      sent.push(mail);
      return okAsync(undefined);
    });
    const subject = mailer(send);

    await subject.sendVerification({ to: 'a@example.org', url: 'https://x/verify', locale: 'en' });
    await subject.sendPasswordReset({ to: 'b@example.org', url: 'https://x/reset', locale: 'en' });
    await subject.sendInvitation({ to: 'c@example.org', token: 'tok', locale: 'de' });
    await subject.sendExistingAccountNotice({ to: 'd@example.org', locale: 'de' });

    expect(sent.map((mail) => mail.to)).toEqual([
      'a@example.org',
      'b@example.org',
      'c@example.org',
      'd@example.org',
    ]);
    expect(sent[2]?.text).toContain('https://civo.example/de/invitation?token=tok');
    expect(sent[3]?.text).toContain('https://civo.example/de/sign-in');
  });

  it('answers a delivery failure with the auth module’s own code, keeping the transport error as the cause', async () => {
    const failure = transportFailure(new Error('SMTP delivery failed ECONNECTION'));
    const subject = mailer(() => errAsync(failure));

    const error = (
      await subject.sendVerification({ to: 'a@example.org', url: 'https://x/verify', locale: 'en' })
    )._unsafeUnwrapErr();

    expect(error).toMatchObject({
      kind: 'infrastructure',
      code: AUTH_ERROR_CODES.mailDeliveryFailed,
      cause: failure,
    });
  });

  it('never puts the single-use link in the error', async () => {
    const subject = mailer(() => errAsync(transportFailure(new Error('x'))));

    const error = (
      await subject.sendInvitation({ to: 'a@example.org', token: 'SINGLE-USE-TOKEN', locale: 'en' })
    )._unsafeUnwrapErr();

    expect(JSON.stringify(error)).not.toContain('SINGLE-USE-TOKEN');
  });
});
