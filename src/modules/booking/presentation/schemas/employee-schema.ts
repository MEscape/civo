import { z } from 'zod';

import { BOOKING_VALIDATION_CODES as CODES } from '../../application/contracts/booking-constraints';
import { MAX_PREFERRED_SERVICES, PARTS_OF_DAY } from '../../application/contracts/employee-inputs';
import { FIT_LEVEL_TABS } from '../forms/open-bookings';

import { idSchema } from './booking-fields-schema';
import { ANY_FILTER } from './parse-service-list-input';

const MINUTES_PER_DAY = 1440;
const minuteSchema = z
  .number({ message: CODES.timeRangeInvalid })
  .int({ message: CODES.timeRangeInvalid })
  .min(0, { message: CODES.timeRangeInvalid })
  .max(MINUTES_PER_DAY, { message: CODES.timeRangeInvalid });

/** What the preferences form sends; the server checks that every id is one of the website's. */
/** What the preferences form edits: the website is not a field of it. */
export const preferencesFormSchema = z.object({
  serviceIds: z.array(idSchema).max(MAX_PREFERRED_SERVICES, { message: CODES.tooMany }),
  window: z
    .object({ startMinute: minuteSchema, endMinute: minuteSchema })
    .refine(({ startMinute, endMinute }) => startMinute < endMinute, {
      message: CODES.timeRangeInvalid,
      path: ['endMinute'],
    })
    .nullable(),
});

export type SavePreferencesValues = z.infer<typeof preferencesFormSchema>;

export const savePreferencesSchema = preferencesFormSchema.extend({ websiteId: idSchema });

/** One message, or (`null`) every unread one. */
export const markMessagesReadSchema = z.object({
  websiteId: idSchema,
  messageId: idSchema.nullable(),
});

/** A repeated parameter (`?q=a&q=b`) is its first value. */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
const queryParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess(firstOf, schema.optional().catch(undefined));
const dateParam = queryParam(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const SEARCH_MAX = 120;

const dayPlanParams = z.object({ date: dateParam });

const openParams = z.object({
  date: dateParam,
  location: queryParam(idSchema),
  part: queryParam(z.enum(PARTS_OF_DAY)),
  fit: queryParam(z.enum(FIT_LEVEL_TABS)),
  q: queryParam(z.string().trim().max(SEARCH_MAX)),
  page: z.preprocess(firstOf, z.unknown()),
});

const pageParams = z.object({ page: z.preprocess(firstOf, z.unknown()) });

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

/** The day of the plan the address asks for; anything that is not a day is today. */
export function parseDayPlanParams(raw: RawParams): { readonly date?: string | undefined } {
  return dayPlanParams.parse(raw);
}

export type OpenListParams = z.infer<typeof openParams>;

/** The filters of the open bookings as the address carries them; what does not fit is no filter. */
export function parseOpenListParams(raw: RawParams): OpenListParams {
  const parsed = openParams.parse(raw);
  return {
    ...parsed,
    location: parsed.location === ANY_FILTER ? undefined : parsed.location,
    q: parsed.q === '' ? undefined : parsed.q,
  };
}

/** The page of the inbox; resolved and bounded by the use case. */
export function parseMessagesParams(raw: RawParams): { readonly page: number | undefined } {
  const page = Number(pageParams.parse(raw).page);
  return { page: Number.isSafeInteger(page) && page >= 1 ? page : undefined };
}
