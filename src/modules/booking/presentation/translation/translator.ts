import type { getTranslations } from '@i18n/server';

/** The `booking` translator a Server Component gets from `getTranslations('booking')`. */
export type BookingTranslator = Awaited<ReturnType<typeof getTranslations<'booking'>>>;
