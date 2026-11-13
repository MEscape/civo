import { fieldPath } from '@lib/errors';

import type { ServiceOriginDto } from '../dto/service-dto';

/** The message that tells how a service came to be at a location, with the values it is worded with. */
export function originMessage(origin: ServiceOriginDto) {
  switch (origin.kind) {
    case 'own':
      return { key: fieldPath('services', 'origin', 'own'), values: {} } as const;
    case 'copy':
      return origin.from === null
        ? ({ key: fieldPath('services', 'origin', 'copyUnknown'), values: {} } as const)
        : ({
            key: fieldPath('services', 'origin', 'copy'),
            values: { from: origin.from.name },
          } as const);
    case 'linked':
      return origin.from === null
        ? ({ key: fieldPath('services', 'origin', 'linkedUnknown'), values: {} } as const)
        : ({
            key: fieldPath('services', 'origin', 'linked'),
            values: { from: origin.from.name },
          } as const);
  }
}
