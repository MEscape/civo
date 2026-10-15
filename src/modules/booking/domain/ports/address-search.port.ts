import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/** One address the search offers. `label` is what is stored and shown: a full postal line. */
export interface AddressSuggestion {
  /** Stable for the same place, so a list can key on it. */
  readonly key: string;
  readonly label: string;
}

/**
 * Finds postal addresses for what a person has typed so far. The external
 * service behind it (a geocoder) is an infrastructure choice; an address is
 * only ever suggested, never required to come from it: a person may always
 * type their own.
 */
export interface AddressSearch {
  /** At most `limit` suggestions, best first. `language` is a two-letter code. */
  search(request: {
    readonly query: string;
    readonly language: string;
    readonly limit: number;
  }): AppResultAsync<readonly AddressSuggestion[], InfrastructureAppError>;
}
