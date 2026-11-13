import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type BookingAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

/**
 * A website whose bookings the actor may work with, checked against the actor's current
 * memberships and independently of the website open in the session. The actor carries the tenant
 * of that website, so every scope, audit event and rate-limit subject belongs to the authorized
 * target and to nothing the request says.
 */
export interface BookingAccessScope {
  readonly actor: Actor;
  readonly websiteId: WebsiteId;
}

/** Auth owns permission decisions; booking use cases receive only the authorized scope. */
export interface BookingAccess {
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<BookingAccessScope, BookingAccessError>;
}
