import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import type { WebsiteBrandRepository } from '@modules/booking/domain/ports/website-brand.repository';
import { renderBookingEmail } from '@modules/booking/infrastructure/mail/booking-email-templates';
import { EmailBookingNotifier } from '@modules/booking/infrastructure/mail/email-booking-notifier';

import { infrastructureError } from '@lib/errors';
import { PLATFORM_EMAIL_BRAND } from '@lib/mail';
import type { EmailBrand, MailTransport, OutboundMail } from '@lib/mail';
import { errAsync, okAsync } from '@lib/result';

const errorLog = vi.hoisted(() => vi.fn());

vi.mock('@lib/logger', () => ({
  logger: { withContext: () => ({ error: errorLog, warn: vi.fn() }) },
}));
vi.mock('@lib/mail/server', () => ({ resolveMailLocale: () => Promise.resolve('de') }));

const WEBSITE_BRAND: EmailBrand = {
  primary: '#7a1f3d',
  primaryForeground: '#ffffff',
  primaryCopy: '#7a1f3d',
  radius: '12px',
};

/** A store with one themed website; every other website has no theme, and `isDown` makes every read fail. */
function brandStore(options: { readonly isDown?: boolean } = {}): WebsiteBrandRepository {
  return {
    findPrimaryColorOf: (websiteId) =>
      options.isDown === true
        ? errAsync(infrastructureError('booking.persistence_failed', 'down'))
        : okAsync(websiteId === 'site-1' ? '#7a1f3d' : null),
  };
}

const NOTICE: BookingNotice = {
  kind: 'confirmed',
  websiteId: toWebsiteId('site-1'),
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
    const mail = renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND);

    expect(mail.subject).toBe('Your appointment is confirmed');
    expect(mail.text).toContain('Tuesday, January 5, 2027');
    expect(mail.text).toContain('10:00 AM');
    expect(mail.text).toContain('Europe/Berlin');
    expect(mail.text).toContain('Town hall, Main street 1');
    expect(mail.text).toContain('ABCDE23456');
  });

  it('is written in the language it is sent in', () => {
    const mail = renderBookingEmail(NOTICE, 'de', PLATFORM_EMAIL_BRAND);

    expect(mail.subject).toBe('Ihr Termin ist bestätigt');
    expect(mail.text).toContain('Dienstag, 5. Januar 2027');
    expect(mail.text).toContain('10:00');
  });

  it('escapes what the service administrator typed', () => {
    const mail = renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND);

    expect(mail.html).not.toContain('<b>renewal</b>');
    expect(mail.html).toContain('&lt;b&gt;renewal&lt;/b&gt;');
  });

  it('asks to bring documents only for an appointment that still stands', () => {
    expect(renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).text).toContain('Old passport');
    expect(
      renderBookingEmail({ ...NOTICE, kind: 'cancelled' }, 'en', PLATFORM_EMAIL_BRAND).text,
    ).not.toContain('Old passport');
  });

  it('takes the colours and corners of the website it was booked on', () => {
    const mail = renderBookingEmail({ ...NOTICE, kind: 'confirmed' }, 'en', WEBSITE_BRAND);

    expect(mail.html).toContain('border-radius: 12px');
    expect(mail.html).not.toContain(PLATFORM_EMAIL_BRAND.primary);
  });

  it('names the number of people only when there is more than one', () => {
    expect(renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).text).not.toContain('People');
    expect(
      renderBookingEmail({ ...NOTICE, participants: 3 }, 'en', PLATFORM_EMAIL_BRAND).text,
    ).toContain('People: 3');
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

    const result = await new EmailBookingNotifier(transport, brandStore()).notify(NOTICE);

    expect(result.isOk()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.org');
    expect(sent[0]?.subject).toBe('Ihr Termin ist bestätigt');
  });

  it('looks like the website the booking was made on, and like the platform when it has no theme or cannot be read', async () => {
    const sent: OutboundMail[] = [];
    const transport: MailTransport = {
      send: (mail) => {
        sent.push(mail);
        return okAsync(undefined);
      },
    };

    await new EmailBookingNotifier(transport, brandStore()).notify(NOTICE);
    await new EmailBookingNotifier(transport, brandStore()).notify({
      ...NOTICE,
      websiteId: toWebsiteId('no-theme'),
    });
    await new EmailBookingNotifier(transport, brandStore({ isDown: true })).notify(NOTICE);

    expect(sent[0]?.html).toContain(WEBSITE_BRAND.primary);
    expect(sent[1]?.html).toContain(PLATFORM_EMAIL_BRAND.primary);
    expect(sent[2]?.html).toContain(PLATFORM_EMAIL_BRAND.primary);
  });

  it('absorbs a failed delivery, so a stored booking is never undone, and logs it without the address', async () => {
    const transport: MailTransport = {
      send: () => errAsync(infrastructureError('mail.delivery_failed', 'down')),
    };

    const result = await new EmailBookingNotifier(transport, brandStore()).notify(NOTICE);

    expect(result.isOk()).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('ada@example.org');
  });
});
