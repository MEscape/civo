import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { persistenceFailed } from '../../domain/errors/booking-errors';
import { createBookableServiceDraft } from '../../domain/models/bookable-service';
import { toBookableServiceId, toWebsiteId } from '../../domain/models/ids';
import { readStoredService } from '../../domain/models/stored-shapes';

import type { BookableService } from '../../domain/models/bookable-service';

export interface ServiceRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteId: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly isActive: boolean;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly locationIds: unknown;
  readonly requirements: unknown;
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
  readonly noticeMinutes: number;
  readonly horizonDays: number;
  readonly availability: unknown;
  readonly cancellation: unknown;
  readonly rescheduling: unknown;
  readonly information: unknown;
  readonly requiredDocuments: unknown;
  readonly instructions: string | null;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export const SERVICE_SELECT = [
  'id',
  'tenantId',
  'websiteId',
  'name',
  'description',
  'category',
  'isActive',
  'durationMinutes',
  'preparationMinutes',
  'cleanupMinutes',
  'slotIntervalMinutes',
  'locationIds',
  'requirements',
  'participantsPerBooking',
  'participantsPerSession',
  'noticeMinutes',
  'horizonDays',
  'availability',
  'cancellation',
  'rescheduling',
  'information',
  'requiredDocuments',
  'instructions',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ServiceRecord>;

export function toService(
  record: ServiceRecord,
): AppResult<BookableService, InfrastructureAppError> {
  const stored = readStoredService(record);
  if (stored === null) {
    return err(persistenceFailed(new Error('A stored service has JSON of an unexpected shape.')));
  }
  const draft = createBookableServiceDraft({
    websiteId: toWebsiteId(record.websiteId),
    name: record.name,
    description: record.description,
    category: record.category,
    isActive: record.isActive,
    durationMinutes: record.durationMinutes,
    preparationMinutes: record.preparationMinutes,
    cleanupMinutes: record.cleanupMinutes,
    slotIntervalMinutes: record.slotIntervalMinutes,
    participantsPerBooking: record.participantsPerBooking,
    participantsPerSession: record.participantsPerSession,
    noticeMinutes: record.noticeMinutes,
    horizonDays: record.horizonDays,
    instructions: record.instructions,
    locationIds: stored.locationIds,
    requirements: stored.requirements,
    availability: stored.availability,
    cancellation: stored.cancellation,
    rescheduling: stored.rescheduling,
    information: stored.information,
    requiredDocuments: stored.requiredDocuments,
  });
  if (draft.isErr()) {
    return err(persistenceFailed(draft.error));
  }
  return ok({
    ...draft.value,
    id: toBookableServiceId(record.id),
    tenantId: toTenantId(record.tenantId),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  });
}
