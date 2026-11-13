import type { ActorId } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import type { BookingAccessError } from './booking-access.port';
import type { WebsiteId } from '../models/ids';

/** A member who works as an employee: who, and what to call them. Never an e-mail address. */
export interface TeamMember {
  readonly id: ActorId;
  readonly name: string;
}

/** The employees of a website, and whether the website has more than one answer names. */
export interface TeamRoster {
  readonly members: readonly TeamMember[];
  readonly isTruncated: boolean;
}

/**
 * The members of the named website who hold the role `employee`, read from the member directory of
 * the auth module, which authorizes the website itself.
 */
export interface TeamDirectory {
  listEmployees(websiteId: WebsiteId): AppResultAsync<TeamRoster, BookingAccessError>;
}
