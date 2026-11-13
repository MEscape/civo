import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';
import type { BookingChoicesView } from '../contracts/service-views';

export type GetBookingChoicesError = BookingAccessError | InfrastructureAppError;

/**
 * What the page editor offers when the booking component is narrowed to a service or a category:
 * the website's switched-on services (id, name, category) and the categories they use, by name.
 * Only what a visitor could see anyway, so it is open to anyone who may edit pages (`page.update`),
 * not only to the booking administration.
 */
export class GetBookingChoices {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: WebsiteTargetInput): AppResultAsync<BookingChoicesView, GetBookingChoicesError> {
    const { access, services } = this.deps;

    return access.authorizeWebsite('page.update', input.websiteId).andThen(({ actor }) =>
      services
        .listNames(scopeOfActor(actor), SERVICE_LIMITS.listMax)
        .map(({ services: all, isTruncated }) => {
          const running = all.filter((service) => service.isActive);
          return {
            isTruncated,
            services: running.map(({ id, name, category }) => ({ id, name, category })),
            categories: unique(
              running.flatMap(({ category }) => (category === null ? [] : [category])),
            ).sort((a, b) => a.localeCompare(b)),
          };
        }),
    );
  }
}
