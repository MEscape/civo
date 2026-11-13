import { parseLocationInput } from '../../application/contracts/booking-constraints';

import type { ExceptionInputDto } from '../dto/location-dto';

const DAYS_PER_WEEK = 7;
const CLOSED_WEEK = Array.from({ length: DAYS_PER_WEEK }, () => ({ intervals: [], breaks: [] }));
const PREFIX = 'openingHours.exceptions.';

/** The refusals of the rules for a list of exceptions, by dotted path inside the list (`0.from`), as codes. */
function problemsOf(list: readonly ExceptionInputDto[]): Record<string, string> {
  // The rules read a whole location; the rest of it is something that is always valid, so only the exceptions can refuse.
  const result = parseLocationInput({
    name: 'Location',
    address: '',
    timeZone: 'Europe/Berlin',
    isActive: true,
    openingHours: { weekly: CLOSED_WEEK, exceptions: [...list] },
  });
  if (result.isOk()) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(result.error.fieldErrors).flatMap(([path, codes]) =>
      path.startsWith(PREFIX) && codes[0] !== undefined
        ? [[path.slice(PREFIX.length), codes[0]]]
        : [],
    ),
  );
}

/**
 * What stops the exception at `index` of `next` from being saved, as the very rules the server applies
 * (so the dialog that edits one says the same at the same field): codes by path inside the exception
 * (`from`, `day.intervals.0.end`). A refusal that the change causes in *another* exception (it overlaps
 * one that is already there, and the rules name the later one) is put on this one's first day, where
 * the person can act on it.
 */
export function exceptionProblems(
  previous: readonly ExceptionInputDto[],
  next: readonly ExceptionInputDto[],
  index: number,
): Record<string, string> {
  const before = problemsOf(previous);
  const own = `${String(index)}.`;
  const entries = Object.entries(problemsOf(next));
  return Object.fromEntries(
    entries.flatMap(([path, code]) => {
      if (path.startsWith(own)) {
        return [[path.slice(own.length), code]];
      }
      return before[path] === undefined ? [['from', code]] : [];
    }),
  );
}
