import { toJsonValue } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookingLocationId } from '../../domain/models/ids';

import { writeAvailability } from './availability-record-mapper';
import { SERVICE_SELECT, toService } from './bookable-service-record-mapper';
import { readInstant } from './instant-record-mapper';

import type { ServiceRecord } from './bookable-service-record-mapper';
import type {
  StoredServiceLocation,
  NewService,
  StoredService,
} from '../../domain/models/stored-service';

/** The whole row of a service: what the rules read, and what the administration describes. */
export interface StoredServiceRecord extends ServiceRecord {
  readonly description: string | null;
  readonly category: string | null;
  readonly requiredDocuments: unknown;
  readonly instructions: string | null;
  readonly internalNote: string | null;
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
  readonly homeLocationId: string | null;
  readonly copiedFromLocationId: string | null;
  readonly updatedAt: InstantRecord;
}

export const STORED_SERVICE_SELECT = [
  ...SERVICE_SELECT,
  'description',
  'category',
  'requiredDocuments',
  'instructions',
  'internalNote',
  'participantsPerBooking',
  'participantsPerSession',
  'homeLocationId',
  'copiedFromLocationId',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof StoredServiceRecord>;

const isTextList = arrayOf(isString);

/** A service as the administration reads it; data that is not in the shape the rules expect is a failure. */
export function toStoredService(
  record: StoredServiceRecord,
  locations: readonly StoredServiceLocation[],
): AppResult<StoredService, InfrastructureAppError> {
  const updatedAt = readInstant(record.updatedAt);
  const { requiredDocuments } = record;
  if (updatedAt === null || !isTextList(requiredDocuments)) {
    return err(bookingDataInvalid('service'));
  }
  return toService(record, locations).andThen((service) =>
    ok({
      ...service,
      locations,
      description: record.description,
      category: record.category,
      requiredDocuments,
      instructions: record.instructions,
      internalNote: record.internalNote,
      participantsPerBooking: record.participantsPerBooking,
      participantsPerSession: record.participantsPerSession,
      homeLocationId:
        record.homeLocationId === null ? null : toBookingLocationId(record.homeLocationId),
      copiedFromLocationId:
        record.copiedFromLocationId === null
          ? null
          : toBookingLocationId(record.copiedFromLocationId),
      updatedAt,
    }),
  );
}

/** The columns a write sets, from what the rules hold; policies and plans become the stored JSON shapes. */
export function toServiceColumns(service: NewService) {
  const policy = ({ isAllowed, deadlineMinutes, allowedActors }: NewService['cancellation']) =>
    toJsonValue({ isAllowed, deadlineMinutes, allowedActors });
  return {
    name: service.name,
    description: service.description,
    category: service.category,
    isActive: service.isActive,
    durationMinutes: service.rules.durationMinutes,
    preparationMinutes: service.rules.preparationMinutes,
    cleanupMinutes: service.rules.cleanupMinutes,
    slotIntervalMinutes: service.rules.stepMinutes,
    requirements: toJsonValue(
      service.requirements.map(({ resourceType, skills, count, resourceIds }) => ({
        resourceType,
        skills,
        count,
        resourceIds,
      })),
    ),
    participantsPerBooking: service.participantsPerBooking,
    participantsPerSession: service.participantsPerSession,
    noticeMinutes: service.noticeMinutes,
    horizonDays: service.horizonDays,
    availability:
      service.availability === null ? null : toJsonValue(writeAvailability(service.availability)),
    cancellation: policy(service.cancellation),
    rescheduling: policy(service.rescheduling),
    information: toJsonValue(service.information),
    requiredDocuments: toJsonValue(service.requiredDocuments),
    instructions: service.instructions,
    internalNote: service.internalNote,
    assignmentMode: service.assignmentMode,
    homeLocationId: service.homeLocationId,
    copiedFromLocationId: service.copiedFromLocationId,
  };
}
