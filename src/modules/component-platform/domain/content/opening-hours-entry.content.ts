import { boolean, oneOf, optional, text, withDefault } from '../models/field-schema';

import { defineContent } from './define-content';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const TIME_LENGTH = 5;

const time = () => optional(text({ max: TIME_LENGTH, pattern: TIME_PATTERN }));

/** The opening hours of one weekday, Monday first. */
export const openingHoursEntryContent = defineContent({
  shape: {
    day: oneOf(WEEKDAYS),
    closed: withDefault(boolean(), false),
    opensAt: time(),
    closesAt: time(),
  },
  rule: {
    compare: (first, second) => WEEKDAYS.indexOf(first.day) - WEEKDAYS.indexOf(second.day),
  },
}).withSample(() => [
  { day: 'mon', closed: false, opensAt: '08:00', closesAt: '12:00' },
  { day: 'tue', closed: false, opensAt: '08:00', closesAt: '12:00' },
  { day: 'wed', closed: true },
  { day: 'thu', closed: false, opensAt: '08:00', closesAt: '18:00' },
  { day: 'fri', closed: false, opensAt: '08:00', closesAt: '12:00' },
  { day: 'sat', closed: true },
  { day: 'sun', closed: true },
]);
