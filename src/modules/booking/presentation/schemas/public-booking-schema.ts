import { z } from 'zod';

import { I18N_CONFIG } from '@i18n';

import {
  customerSchema,
  daySchema,
  emailSchema,
  idSchema,
  instantSchema,
  referenceSchema,
} from './booking-fields-schema';

/**
 * What the public booking actions accept. The website is named because a visitor has no account to
 * take it from; the server checks that it exists and takes the tenant from its own record.
 */
export const availableSlotsSchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  from: daySchema,
  to: daySchema,
});

export const holdSlotSchema = z.object({
  websiteId: idSchema,
  serviceId: idSchema,
  locationId: idSchema,
  start: instantSchema,
  /** The language of the page: the visitor's messages are written in it. */
  locale: z.enum(I18N_CONFIG.locales).optional(),
});

export const confirmBookingSchema = z.object({
  websiteId: idSchema,
  bookingId: idSchema,
  customer: customerSchema,
});

export const releaseHoldSchema = z.object({
  websiteId: idSchema,
  bookingId: idSchema,
});

/** A booking reached the way a visitor reaches it: the reference and the address it was made with. */
export const publicBookingKeySchema = z.object({
  websiteId: idSchema,
  reference: referenceSchema,
  email: emailSchema,
});

export const rescheduleOwnBookingSchema = publicBookingKeySchema.extend({
  start: instantSchema,
});

export const ownBookingSlotsSchema = publicBookingKeySchema.extend({
  from: daySchema,
  to: daySchema,
});
