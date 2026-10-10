import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import { renderBookingEmail } from '@modules/booking/infrastructure/mail/booking-email-templates';
import { EmailBookingNotifier } from '@modules/booking/infrastructure/mail/email-booking-notifier';

import { infrastructureError } from '@lib/errors';
import type { MailTransport, OutboundMail } from '@lib/mail';
import { errAsync, okAsync } from '@lib/result';

const errorLog = vi.hoisted(() => vi.fn());

vi.mock('@lib/logger', () => ({
  logger: { withContext: () => ({ error: errorLog, warn: vi.fn() }) },
}));
vi.mock('@lib/mail/server', () => ({ resolveMailLocale: () => Promise.resolve('de') }));

const NOTICE: BookingNotice = {
  kind: 'confirmed',
  to: 'ada@example.org',
  reference: 'ABCDE23456',
  serviceName: 'Passport <b>renewal</b>',
  locationName: 'Town hall',
  locationAddress: 'Main street 1',
  localDate: '2027-01-05',
  localTime: '10:00',
  timeZone: 'Europe/Berlin',
  participants: 1,
  requiredDocuments: ['Old passport'],
  instructions: 'Come early.',
};

describe('the booking e-mail', () => {
  it('states when and where, as the clock at the location shows it', () => {
    const mail = renderBookingEmail(NOTICE, 'en');

    expect(mail.subject).toBe('Your appointment is confirmed');
    expect(mail.text).toContain('Tuesday, January 5, 2027');
    expect(mail.text).toContain('10:00 AM');
    expect(mail.text).toContain('Europe/Berlin');
    expect(mail.text).toContain('Town hall, Main street 1');
    expect(mail.text).toContain('ABCDE23456');
  });

  it('is written in the language it is sent in', () => {
    const mail = renderBookingEmail(NOTICE, 'de');

    expect(mail.subject).toBe('Ihr Termin ist bestätigt');
    expect(mail.text).toContain('Dienstag, 5. Januar 2027');
    expect(mail.text).toContain('10:00');
  });

  it('escapes what the service administrator typed', () => {
    const mail = renderBookingEmail(NOTICE, 'en');

    expect(mail.html).not.toContain('<b>renewal</b>');
    expect(mail.html).toContain('&lt;b&gt;renewal&lt;/b&gt;');
  });

  it('asks to bring documents only for an appointment that still stands', () => {
    expect(renderBookingEmail(NOTICE, 'en').text).toContain('Old passport');
    expect(renderBookingEmail({ ...NOTICE, kind: 'cancelled' }, 'en').text).not.toContain(
      'Old passport',
    );
  });

  it('names the number of people only when there is more than one', () => {
    expect(renderBookingEmail(NOTICE, 'en').text).not.toContain('People');
    expect(renderBookingEmail({ ...NOTICE, participants: 3 }, 'en').text).toContain('People: 3');
  });
});

describe('sending the booking e-mail', () => {
  beforeEach(() => {
    errorLog.mockReset();
  });

  it('hands the rendered message to the transport', async () => {
    const sent: OutboundMail[] = [];
    const transport: MailTransport = {
      send: (mail) => {
        sent.push(mail);
        return okAsync(undefined);
      },
    };

    const result = await new EmailBookingNotifier(transport).notify(NOTICE);

    expect(result.isOk()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.org');
    expect(sent[0]?.subject).toBe('Ihr Termin ist bestätigt');
  });

  it('absorbs a failed delivery, so a stored booking is never undone, and logs it without the address', async () => {
    const transport: MailTransport = {
      send: () => errAsync(infrastructureError('mail.delivery_failed', 'down')),
    };

    const result = await new EmailBookingNotifier(transport).notify(NOTICE);

    expect(result.isOk()).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('ada@example.org');
  });
});
