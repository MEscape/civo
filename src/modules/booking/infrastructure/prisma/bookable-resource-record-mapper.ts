import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { persistenceFailed } from '../../domain/errors/booking-errors';
import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { toBookableResourceId, toWebsiteId } from '../../domain/models/ids';

import { storedResourceSchema } from './stored-json-record-mapper';

import type { BookableResource } from '../../domain/models/bookable-resource';

export interface ResourceRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteId: string;
  readonly locationId: string | null;
  readonly name: string;
  readonly type: string;
  readonly skills: unknown;
  readonly capacity: number | null;
  readonly availability: unknown;
  readonly isActive: boolean;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export const RESOURCE_SELECT = [
  'id',
  'tenantId',
  'websiteId',
  'locationId',
  'name',
  'type',
  'skills',
  'capacity',
  'availability',
  'isActive',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ResourceRecord>;

export function toResource(
  record: ResourceRecord,
): AppResult<BookableResource, InfrastructureAppError> {
  const stored = storedResourceSchema.safeParse(record);
  if (!stored.success) {
    return err(persistenceFailed(stored.error));
  }
  const draft = createBookableResourceDraft({
    websiteId: toWebsiteId(record.websiteId),
    locationId: record.locationId,
    name: record.name,
    type: record.type,
    skills: stored.data.skills,
    capacity: record.capacity,
    availability: stored.data.availability,
    isActive: record.isActive,
  });
  if (draft.isErr()) {
    return err(persistenceFailed(draft.error));
  }
  return ok({
    ...draft.value,
    id: toBookableResourceId(record.id),
    tenantId: toTenantId(record.tenantId),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  });
}
