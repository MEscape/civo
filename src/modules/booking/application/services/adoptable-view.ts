import { nameView } from './service-names';

import type { LocationNames } from './service-names';
import type { AdoptableService } from '../../domain/ports/service-admin.repository';
import type { AdoptableServiceView } from '../contracts/service-views';

/** Where an adoptable service is picked from: the place it was made, else the first that has it on. */
function sourceOf(service: AdoptableService, names: LocationNames) {
  const source =
    service.homeLocationId !== null && service.offeredAt.includes(service.homeLocationId)
      ? service.homeLocationId
      : service.offeredAt[0];
  return source === undefined ? null : nameView(source, names);
}

export function toAdoptableView(
  service: AdoptableService,
  names: LocationNames,
): AdoptableServiceView {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    durationMinutes: service.durationMinutes,
    source: sourceOf(service, names),
  };
}
