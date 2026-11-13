import type { Permission } from '@modules/auth';

export type { BookingReaders } from '../../application/contracts/reader-views';

/** The raw query of the request: parsed by the loader, never trusted. */
export type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** What a person may do on the website, as the screens ask for it: display only, every use case authorizes again. */
export type BookingMay = (permission: Permission) => boolean;
