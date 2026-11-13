import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWorkspaces } from '../../domain/ports/booking-workspaces.port';
import type { WorkspaceDependencies } from '../booking-dependencies';

export type ListWorkspacesError = BookingAccessError | InfrastructureAppError;

/**
 * The websites the signed-in person works in through bookings: the hub, the switcher in a workspace's
 * name and the way into bookings from the websites list.
 *
 * @authorization system Only discovers what the person already reaches (auth answers for the signed-in
 * person; without one it answers nothing); every workspace authorizes again for itself.
 */
export class ListWorkspaces {
  constructor(private readonly deps: WorkspaceDependencies) {}

  execute(): AppResultAsync<BookingWorkspaces, ListWorkspacesError> {
    return this.deps.workspaces.list();
  }
}
