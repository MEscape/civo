/**
 * An ISO-8601 instant WITH an offset or `Z` ("2027-01-11T09:00:00+01:00").
 * Instants without an offset are refused: "09:00" means nothing until a zone
 * says where, and guessing the server's zone is how appointments move.
 */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Epoch milliseconds of a well-formed instant, or `null`. */
export function parseInstant(raw: string): number | null {
  if (!INSTANT_PATTERN.test(raw)) {
    return null;
  }
  const epoch = Date.parse(raw);
  return Number.isNaN(epoch) ? null : epoch;
}
