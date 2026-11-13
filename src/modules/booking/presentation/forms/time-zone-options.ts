import type { AutocompleteOption } from '@components/shared/select-field';

const MAX_OPTIONS = 8;

/** `Europe/Bad_Ischl` and "europe bad ischl" are the same words. */
const wordsOf = (text: string) => text.toLowerCase().replaceAll(/[/_]/g, ' ').trim();

/**
 * The zones that match what is typed, as options with their short name beside them (`CEST`): the
 * ones that start with the words first, then those that only contain them. Few, so the list stays a
 * list. `nameOf` words a zone as it is now (summer time included); `undefined` leaves it out.
 */
export function timeZoneOptions(
  query: string,
  zones: readonly string[],
  nameOf: (zone: string) => string | undefined,
): AutocompleteOption[] {
  const wanted = wordsOf(query);
  if (wanted === '') {
    return [];
  }
  const matching = zones.filter((zone) => wordsOf(zone).includes(wanted));
  const ranked = [
    ...matching.filter((zone) => wordsOf(zone).startsWith(wanted)),
    ...matching.filter((zone) => !wordsOf(zone).startsWith(wanted)),
  ];
  return ranked.slice(0, MAX_OPTIONS).map((zone) => {
    const detail = nameOf(zone);
    return detail === undefined ? { value: zone } : { value: zone, detail };
  });
}
