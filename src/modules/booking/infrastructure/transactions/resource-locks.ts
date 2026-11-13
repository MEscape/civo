import { advisoryLock } from '@lib/db';
import { unique } from '@lib/utils';

import { compareIds } from '../../domain/models/ids';

import type { WriteScope } from '../prisma/tenant-ownership';

/**
 * Serializes the writers of one resource, and only of that resource. After acquiring the lock,
 * every writer checks committed resource occupancy, so overlapping requests cannot race past an
 * earlier capacity check. The current DB contract has no exclusion constraint to replace that check.
 * The locks are taken in id order, before the first write, by every writer, so they cannot wait for
 * each other either.
 */
export async function lockResources(
  { tx, scope }: WriteScope,
  resourceIds: readonly string[],
): Promise<void> {
  for (const id of unique(resourceIds).sort(compareIds)) {
    // One by one, in order: that order is what keeps writers from waiting for each other.
    await advisoryLock(tx, `booking-resource:${scope.websiteId}:${id}`);
  }
}
