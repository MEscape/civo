import { getAuthQueries } from '@modules/auth';

import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toWebsiteId } from '../../domain/models/ids';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWorkspaceDirectory } from '../../domain/ports/booking-workspaces.port';

interface Reach {
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly isTruncated: boolean;
}

const NONE: Reach = { websites: [], isTruncated: false };

/** A refusal means nothing of that kind is reachable; any other failure is a real one. */
function reachable(
  pending: AppResultAsync<Reach, BookingAccessError>,
): AppResultAsync<Reach, BookingAccessError> {
  return pending.orElse((error) =>
    error.kind === 'forbidden' || error.kind === 'unauthorized' ? okAsync(NONE) : errAsync(error),
  );
}

/**
 * The websites the person reaches through bookings (to manage them, or to serve in them), from the
 * auth module's list of what they may do where, and which of those they may also open as a website.
 */
export const authBookingWorkspaces: BookingWorkspaceDirectory = {
  list() {
    const { listAccessibleWebsites } = getAuthQueries();
    return ResultAsync.combine([
      reachable(listAccessibleWebsites.execute('booking.read')),
      reachable(listAccessibleWebsites.execute('booking.read.own')),
      reachable(listAccessibleWebsites.execute('website.read')),
    ] as const).map(([managed, own, readable]) => {
      const openable = new Set(readable.websites.map(({ id }) => id));
      const websites = [
        ...new Map([...managed.websites, ...own.websites].map((site) => [site.id, site])).values(),
      ]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ id, name }) => ({ id: toWebsiteId(id), name, canOpenWebsite: openable.has(id) }));
      return {
        websites,
        hasOpenableWebsite: openable.size > 0,
        isTruncated: managed.isTruncated || own.isTruncated,
      };
    });
  },
};
