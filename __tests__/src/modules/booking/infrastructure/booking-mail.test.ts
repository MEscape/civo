import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import type { WebsiteBrandRepository } from '@modules/booking/domain/ports/website-brand.repository';
import {
  renderBookingCalendar,
  renderBookingEmail,
} from '@modules/booking/infrastructure/mail/booking-email-templates';
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
  sender: 'website',
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
    findSlugOf: (websiteId) =>
      options.isDown === true
        ? errAsync(infrastructureError('booking.persistence_failed', 'down'))
        : okAsync(websiteId === 'site-1' ? 'wuerzburg' : null),
  };
}

const LINK = (locale: string, slug: string, reference: string) =>
  `https://civo.example/${locale}/s/${slug}?manage=${reference}`;
const CLOCK = { now: () => new Date('2027-01-01T08:00:00Z') };

const NOTICE: BookingNotice = {
  kind: 'confirmed',
  websiteId: toWebsiteId('site-1'),
  to: 'ada@example.org',
  recipientName: 'Ada',
  reference: 'ABCDE23456',
  serviceName: 'Passport <b>renewal</b>',
  locationName: 'Town hall',
  locationAddress: 'Main street 1',
  localDate: '2027-01-05',
  localTime: '10:00',
  timeZone: 'Europe/Berlin',
  startsAt: new Date('2027-01-05T09:00:00Z'),
  endsAt: new Date('2027-01-05T09:30:00Z'),
  sequence: 2,
  participants: 1,
  requiredDocuments: ['Old passport'],
  instructions: 'Come early.',
};

describe('the booking e-mail', () => {
  it('states when and where, as the clock at the location shows it', () => {
    const mail = renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND);

    expect(mail.text).toContain('Tuesday, January 5, 2027');
    expect(mail.text).toContain('10:00 AM');
    expect(mail.text).toContain('Europe/Berlin');
    expect(mail.text).toContain('Town hall, Main street 1');
    expect(mail.text).toContain('ABCDE23456');
  });

  it('is written in the language it is sent in', () => {
    const mail = renderBookingEmail(NOTICE, 'de', PLATFORM_EMAIL_BRAND);

    expect(mail.subject).toBe('Termin bestätigt: Passport <b>renewal</b>, Di., 5. Jan.');
    expect(mail.html).toContain('Ihr Termin ist bestätigt');
    expect(mail.text).toContain('Dienstag, 5. Januar 2027');
    expect(mail.text).toContain('10:00');
  });

  it('names the appointment in the subject, so the inbox says which one changed', () => {
    const subjectOf = (kind: BookingNotice['kind']) =>
      renderBookingEmail({ ...NOTICE, kind }, 'en', PLATFORM_EMAIL_BRAND).subject;

    expect(subjectOf('confirmed')).toBe(
      'Appointment confirmed: Passport <b>renewal</b>, Tue, Jan 5',
    );
    expect(subjectOf('cancelled')).toMatch(/^Appointment cancelled: /);
    expect(subjectOf('rescheduled')).toMatch(/^Appointment moved: /);
  });

  it('keeps the subject to one line, whatever a service is called', () => {
    const mail = renderBookingEmail(
      { ...NOTICE, serviceName: 'Passport\r\nBcc: x@example.org' },
      'en',
      PLATFORM_EMAIL_BRAND,
    );

    expect(mail.subject).not.toMatch(/[\r\n]/u);
  });

  it('sets the reference apart, in a fixed-width face', () => {
    const html = renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).html;

    expect(html).toMatch(/font-family: ui-monospace[^"]*">ABCDE23456</u);
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

describe('the greeting and the calendar file of the booking e-mail', () => {
  it('greets the visitor by the first name they gave, and not at all when they gave none', () => {
    expect(renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).text).toMatch(/^Hello Ada,/u);
    expect(renderBookingEmail(NOTICE, 'de', PLATFORM_EMAIL_BRAND).text).toMatch(/^Hallo Ada,/u);
    expect(
      renderBookingEmail({ ...NOTICE, recipientName: null }, 'en', PLATFORM_EMAIL_BRAND).text,
    ).not.toMatch(/^Hello/u);
  });

  it('describes the appointment as an entry the calendar can replace', () => {
    const file = renderBookingCalendar(NOTICE, 'en', new Date('2027-01-01T08:00:00Z'));

    expect(file).toMatchObject({ filename: 'appointment.ics' });
    expect(file?.contentType).toContain('text/calendar');
    const lines = file?.content.split('\r\n') ?? [];
    expect(lines).toContain('UID:ABCDE23456@civo');
    expect(lines).toContain('DTSTART:20270105T090000Z');
    expect(lines).toContain('DTEND:20270105T093000Z');
    expect(lines).toContain('DTSTAMP:20270101T080000Z');
    // The number of times it was moved: a calendar keeps the highest.
    expect(lines).toContain('SEQUENCE:2');
    expect(lines).toContain('TRIGGER:-PT60M');
    expect(file?.content.endsWith('\r\n')).toBe(true);
  });

  it('escapes and folds what a service administrator typed, within 75 bytes a line', () => {
    const file = renderBookingCalendar(
      {
        ...NOTICE,
        serviceName: `Pass; port, renewal${' äöü'.repeat(40)}`,
        instructions: 'a\b',
      },
      'en',
      new Date(0),
    );
    const lines = file?.content.split('\r\n') ?? [];

    expect(file?.content).toContain('SUMMARY:Pass\\; port\\, renewal');
    for (const line of lines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it('attaches the file to a confirmation or a move, and to a cancellation not at all', () => {
    const now = new Date(0);

    expect(renderBookingCalendar({ ...NOTICE, kind: 'rescheduled' }, 'de', now)?.filename).toBe(
      'termin.ics',
    );
    expect(renderBookingCalendar({ ...NOTICE, kind: 'cancelled' }, 'en', now)).toBeNull();
    expect(renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).text).toContain('calendar file');
    expect(
      renderBookingEmail({ ...NOTICE, kind: 'cancelled' }, 'en', PLATFORM_EMAIL_BRAND).text,
    ).not.toContain('calendar file');
  });
});

describe('the link to the booking in the e-mail', () => {
  const URL = 'https://civo.example/de/s/wuerzburg?manage=ABCDE23456';

  it('leads a confirmation or a move back to the booking, with the reference in the address', () => {
    for (const kind of ['confirmed', 'rescheduled'] as const) {
      const mail = renderBookingEmail({ ...NOTICE, kind }, 'en', PLATFORM_EMAIL_BRAND, URL);

      expect(mail.html).toContain(`href="${URL}"`);
      expect(mail.text).toContain(`View or change appointment: ${URL}`);
    }
  });

  it('has no link for a cancellation, or when the website cannot be found', () => {
    expect(
      renderBookingEmail({ ...NOTICE, kind: 'cancelled' }, 'en', PLATFORM_EMAIL_BRAND, URL).html,
    ).not.toContain('<a ');
    expect(renderBookingEmail(NOTICE, 'en', PLATFORM_EMAIL_BRAND).html).not.toContain('<a ');
  });

  it('builds the link from the website slug, and sends the message without one when the slug cannot be read', async () => {
    const sent: OutboundMail[] = [];
    const transport: MailTransport = {
      send: (mail) => {
        sent.push(mail);
        return okAsync(undefined);
      },
    };

    await new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK).notify(NOTICE);
    await new EmailBookingNotifier(transport, brandStore({ isDown: true }), CLOCK, LINK).notify(
      NOTICE,
    );

    expect(sent[0]?.text).toContain('https://civo.example/de/s/wuerzburg?manage=ABCDE23456');
    expect(sent[1]?.text).not.toContain('civo.example');
    expect(sent).toHaveLength(2);
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

    const result = await new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK).notify(
      NOTICE,
    );

    expect(result.isOk()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.org');
    expect(sent[0]?.subject).toContain('Termin bestätigt');
  });

  it('sends the calendar file along with a confirmation', async () => {
    const sent: OutboundMail[] = [];
    const transport: MailTransport = {
      send: (mail) => {
        sent.push(mail);
        return okAsync(undefined);
      },
    };
    const notifier = new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK);

    await notifier.notify(NOTICE);
    await notifier.notify({ ...NOTICE, kind: 'cancelled' });

    expect(sent[0]?.attachments).toHaveLength(1);
    expect(sent[0]?.attachments?.[0]?.filename).toBe('termin.ics');
    expect(sent[1]?.attachments).toEqual([]);
  });

  it('looks like the website the booking was made on, and like the platform when it has no theme or cannot be read', async () => {
    const sent: OutboundMail[] = [];
    const transport: MailTransport = {
      send: (mail) => {
        sent.push(mail);
        return okAsync(undefined);
      },
    };

    await new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK).notify(NOTICE);
    await new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK).notify({
      ...NOTICE,
      websiteId: toWebsiteId('no-theme'),
    });
    await new EmailBookingNotifier(transport, brandStore({ isDown: true }), CLOCK, LINK).notify(
      NOTICE,
    );

    expect(sent[0]?.html).toContain(WEBSITE_BRAND.primary);
    expect(sent[1]?.html).toContain(PLATFORM_EMAIL_BRAND.primary);
    expect(sent[2]?.html).toContain(PLATFORM_EMAIL_BRAND.primary);
  });

  it('absorbs a failed delivery, so a stored booking is never undone, and logs it without the address', async () => {
    const transport: MailTransport = {
      send: () => errAsync(infrastructureError('mail.delivery_failed', 'down')),
    };

    const result = await new EmailBookingNotifier(transport, brandStore(), CLOCK, LINK).notify(
      NOTICE,
    );

    expect(result.isOk()).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('ada@example.org');
  });
});
