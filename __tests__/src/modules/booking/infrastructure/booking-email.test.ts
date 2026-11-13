import { describe, expect, it, vi } from 'vitest';

import { toBookingReference } from '@modules/booking/domain/models/booking-reference';
import {
  toBookableServiceId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import type { TimeZone } from '@modules/booking/domain/time/time-zone';
import { renderBookingEmail } from '@modules/booking/infrastructure/notification/booking-email';
import { EmailBookingNotifier } from '@modules/booking/infrastructure/notification/email-booking-notifier';

import { PLATFORM_EMAIL_BRAND, mailDeliveryFailed } from '@lib/mail';
import type { OutboundMail } from '@lib/mail';
import { errAsync, okAsync } from '@lib/result';

import { at } from '../support/time-fixtures';

const mocks = vi.hoisted(() => ({
  requestLocale: vi.fn(() => Promise.resolve('de')),
  logged: [] as unknown[],
}));
vi.mock('server-only', () => ({}));
vi.mock('@lib/mail/server', () => ({ resolveMailLocale: mocks.requestLocale }));
vi.mock('@lib/logger', () => {
  const log = (...args: unknown[]) => void mocks.logged.push(args);
  const sink = { error: log, warn: log, info: log, debug: log };
  return { logger: { withContext: () => sink } };
});

const NOTICE: BookingNotice = {
  kind: 'confirmed',
  websiteId: toWebsiteId('site'),
  to: 'mira@example.org',
  recipientName: 'Mira',
  reference: toBookingReference('7KQ2M9XB4C'),
  serviceId: toBookableServiceId('svc'),
  locationId: toBookingLocationId('loc'),
  serviceName: 'Reisepass; neu',
  locationName: 'Rathaus West',
  locationAddress: 'Marktplatz 1, 12345 Musterstadt',
  locale: 'de',
  start: at('2027-01-11', '09:00'),
  end: at('2027-01-11', '09:30'),
  zone: 'Europe/Berlin' as TimeZone,
  sequence: 1,
};
const NOW = new Date('2027-01-10T11:00:00Z');
const options = {
  brand: PLATFORM_EMAIL_BRAND,
  manageUrl: 'https://civo.test/de/s/site?manage=7KQ2M9XB4C#booking',
  now: NOW,
};

describe('the booking message', () => {
  it('confirms in German with the time on the location’s clock, the place, the number and a calendar file', () => {
    const mail = renderBookingEmail(NOTICE, { ...options, locale: 'de' });

    expect(mail.subject).toBe('Termin gebucht: Reisepass; neu, 11.01.2027');
    expect(mail.text).toContain('Hallo Mira,');
    expect(mail.text).toContain('09:00');
    expect(mail.text).toContain('Ortszeit (Europe/Berlin)');
    expect(mail.text).toContain('Rathaus West, Marktplatz 1, 12345 Musterstadt');
    expect(mail.text).toContain('7KQ2M9XB4C');
    expect(mail.text).toContain(options.manageUrl);
    const [calendar] = mail.attachments;
    expect(calendar?.filename).toBe('termin.ics');
    expect(calendar?.content).toContain('DTSTART:20270111T080000Z\r\n');
    expect(calendar?.content).toContain('DTEND:20270111T083000Z\r\n');
    expect(calendar?.content).toContain('UID:7KQ2M9XB4C@civo\r\n');
    expect(calendar?.content).toContain('SEQUENCE:1\r\n');
    expect(calendar?.content).toContain('SUMMARY:Reisepass\\; neu\r\n');
    expect(
      calendar?.content.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
  });

  it('cancels in English without a calendar file or a link to change it', () => {
    const mail = renderBookingEmail(
      { ...NOTICE, kind: 'cancelled', serviceName: null },
      { ...options, locale: 'en' },
    );

    expect(mail.subject).toBe('Appointment cancelled: Your appointment, Jan 11, 2027');
    expect(mail.text).toContain('local time (Europe/Berlin)');
    expect(mail.text).not.toContain(options.manageUrl);
    expect(mail.attachments).toEqual([]);
  });
});

describe('the e-mail notifier', () => {
  const identity = () => Promise.resolve({ slug: 'site', brand: PLATFORM_EMAIL_BRAND });

  it('writes in the language the visitor booked in, not the request’s', async () => {
    const sent: OutboundMail[] = [];
    const notifier = new EmailBookingNotifier(
      { send: (mail) => (sent.push(mail), okAsync(undefined)) },
      {
        clock: { now: () => NOW },
        readWebsite: identity,
        manageLink: (locale, slug, ref) => `https://civo.test/${locale}/s/${slug}?manage=${ref}`,
      },
    );

    await notifier.notify({ ...NOTICE, locale: 'en' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('mira@example.org');
    expect(sent[0]?.subject).toMatch(/^Appointment booked/);
    expect(sent[0]?.text).toContain('https://civo.test/en/s/site?manage=7KQ2M9XB4C');
    expect(mocks.requestLocale).not.toHaveBeenCalled();
  });

  it('swallows a failed delivery and logs it without the address, the name or the number', async () => {
    mocks.logged.length = 0;
    const notifier = new EmailBookingNotifier(
      { send: () => errAsync(mailDeliveryFailed(new Error('550'))) },
      {
        clock: { now: () => NOW },
        readWebsite: () => Promise.reject(new Error('db down')),
        manageLink: () => 'https://civo.test',
      },
    );

    const result = await notifier.notify({ ...NOTICE, locale: null });

    expect(result.isOk()).toBe(true);
    expect(mocks.requestLocale).toHaveBeenCalled();
    const log = JSON.stringify(mocks.logged, (_key, value: unknown) =>
      value instanceof Error ? value.message : value,
    );
    expect(log).not.toContain('mira@example.org');
    expect(log).not.toContain('Mira');
    expect(log).not.toContain('7KQ2M9XB4C');
  });
});
