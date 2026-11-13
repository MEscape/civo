import type { ActorId, AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type MapAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

export interface MapScope {
  readonly websiteId: WebsiteId;
  readonly actorId: ActorId;
}

/** Maps are reusable page content, governed by the same capabilities as the page editor. */
export interface MapAccess {
  authorizeWebsite(
    permission: 'page.read' | 'page.update' | 'release.publish',
    rawWebsiteId: unknown,
  ): AppResultAsync<MapScope, MapAccessError>;
}
