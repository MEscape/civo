import { linkedResourceIds } from '../prisma/service-location-record-mapper';
import { resourcesOf } from '../prisma/tenant-ownership';

import type { ResourceKind } from '../../domain/models/bookable-resource';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { ServiceLocationRecord } from '../prisma/service-location-record-mapper';

/**
 * The type of every resource the given settings link to, read from the resources themselves in one
 * statement and pinned to the scope, so the types the rules use are the current ones.
 */
export async function loadResourceTypes(
  scope: BookingScope,
  records: readonly ServiceLocationRecord[],
): Promise<Map<string, ResourceKind>> {
  const ids = linkedResourceIds(records);
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await resourcesOf(scope)
    .where((resource) => resource.id.in(ids))
    .select('id', 'type')
    .all();
  return new Map(rows.map((row) => [row.id, row.type]));
}
