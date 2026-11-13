import type { InfrastructureAppError } from '@lib/errors';
import { offsetOf, resolvePageRequest, toPage } from '@lib/pagination';
import { combineAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined, keyBy, unique } from '@lib/utils';

import { CALENDAR_CHANGED } from '../../domain/models/actor-message';
import { formatInstantInZone } from '../../domain/time/instant-format';
import { addLocalDays, formatLocalDate } from '../../domain/time/local-date';
import { localDateOf } from '../../domain/time/time-zone';
import { MESSAGE_PAGE_LIMITS } from '../booking-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { homeZoneOf, loadLocations } from '../services/employee-labels';

import type { ActorMessage } from '../../domain/models/actor-message';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { Instant } from '../../domain/time/instant';
import type { TimeZone } from '../../domain/time/time-zone';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { ListMessagesInput } from '../contracts/employee-inputs';
import type { MessagePageView, MessageView } from '../contracts/employee-views';
import type { LocationsById } from '../services/employee-labels';

export type ListMessagesError = BookingAccessError | InfrastructureAppError;

/**
 * The signed-in member's inbox, newest first, a page at a time, with the unread count. A message is
 * worded by the screen from its type; the names of its service and location are read now, and its
 * times are on the clock of the booking's location. Nobody reads another member's messages: the
 * member is the session's, never an id from the request.
 */
export class ListMessages {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: ListMessagesInput): AppResultAsync<MessagePageView, ListMessagesError> {
    const { access, messages, resources, serviceAdmin } = this.deps;
    const now = currentInstant(this.deps.clock);
    const request = resolvePageRequest({ page: input.page }, MESSAGE_PAGE_LIMITS);

    return access.authorizeWebsite('booking.read.own', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return messages
        .list(scope, actor.id, { limit: request.pageSize, offset: offsetOf(request) })
        .andThen((found) =>
          resources.findEmployeeOf(scope, actor.id).andThen((own) =>
            loadLocations(this.deps, scope).andThen((locations) =>
              combineAsync(
                unique(
                  found.items.flatMap((message) =>
                    'serviceId' in message ? [message.serviceId] : [],
                  ),
                ).map((id) => serviceAdmin.findById(scope, id)),
              ).map((services): MessagePageView => {
                const zone = homeZoneOf(own, locations);
                const today = zone === null ? null : localDateOf(now, zone);
                const named = keyBy(services.filter(isDefined), (service) => service.id);
                const items = found.items.flatMap((message) =>
                  toMessageView(message, { locations, services: named, zone }),
                );
                return {
                  ...toPage(items, found.total, request),
                  unread: found.unread,
                  today: today === null ? '' : formatLocalDate(today),
                  yesterday: today === null ? '' : formatLocalDate(addLocalDays(today, -1)),
                };
              }),
            ),
          ),
        );
    });
  }
}

function toMessageView(
  message: ActorMessage,
  names: {
    readonly locations: LocationsById;
    readonly services: ReadonlyMap<string, StoredService>;
    readonly zone: TimeZone | null;
  },
): MessageView[] {
  const location = names.locations.get(message.locationId);
  const zone = location?.zone ?? names.zone;
  if (zone === null) {
    return [];
  }
  const at = (instant: Instant) => formatInstantInZone(instant, zone);
  const base = {
    id: message.id,
    locationName: location?.name ?? null,
    timeZone: zone,
    createdAt: at(message.createdAt),
    day: formatLocalDate(localDateOf(message.createdAt, zone)),
    isRead: message.readAt !== null,
  };
  return [
    message.type === CALENDAR_CHANGED
      ? { ...base, type: message.type, parts: message.parts }
      : {
          ...base,
          type: message.type,
          bookingId: message.bookingId,
          serviceName: names.services.get(message.serviceId)?.name ?? null,
          start: at(message.start),
        },
  ];
}
