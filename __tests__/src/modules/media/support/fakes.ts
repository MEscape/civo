import { randomUUID } from 'node:crypto';

import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, TenantId } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { CompleteMediaUpload } from '@modules/media/application/commands/complete-media-upload';
import { DeleteMediaAsset } from '@modules/media/application/commands/delete-media-asset';
import { RequestMediaUpload } from '@modules/media/application/commands/request-media-upload';
import type { MediaDependencies } from '@modules/media/application/media-dependencies';
import { GetMediaReadUrl } from '@modules/media/application/queries/get-media-read-url';
import { ListMediaAssets } from '@modules/media/application/queries/list-media-assets';
import { mediaTooManyPending } from '@modules/media/domain/errors/media-errors';
import { toMediaAssetId } from '@modules/media/domain/models/ids';
import type { MediaAssetId } from '@modules/media/domain/models/ids';
import { mediaObjectKey } from '@modules/media/domain/models/media-asset';
import type { MediaAsset } from '@modules/media/domain/models/media-asset';
import type { MediaAccess } from '@modules/media/domain/ports/media-access.port';
import { DEFAULT_MEDIA_SORT } from '@modules/media/domain/ports/media-asset.repository';
import type {
  AbandonedClaim,
  MediaAssetRepository,
  MediaListFilter,
  NewPendingAsset,
  PendingQuota,
} from '@modules/media/domain/ports/media-asset.repository';
import type { MediaAuditLog, MediaEvent } from '@modules/media/domain/ports/media-audit-log.port';
import type { MediaUsageRepository } from '@modules/media/domain/ports/media-usage.repository';

import type { Clock } from '@lib/clock';
import { forbiddenError, infrastructureError } from '@lib/errors';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { InMemoryObjectStore } from '../../../lib/storage/support/in-memory-object-store';
import { createTestRateLimiter } from '../../../support/rate-limiting';
/** A clock the test moves by hand. */
export class ManualClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

/**
 * Website access for one actor, deciding like auth does: the actor must hold the permission in
 * the named website, whichever website the session has open. Another website's id is refused.
 */
export function accessFor(actor: Actor | null): MediaAccess {
  return {
    authorizeWebsite: (permission, rawWebsiteId) =>
      actor !== null && actor.tenantId === rawWebsiteId && actorHasPermission(actor, permission)
        ? okAsync({ actorId: actor.id, tenantId: actor.tenantId })
        : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  };
}

export function actorWithRole(tenantId: TenantId, role: Actor['roles'][number]): Actor {
  return { id: toActorId(`actor-${role}`), tenantId, roles: [role] };
}

export const TENANT = toTenantId('11111111-1111-4111-8111-111111111111');
export const OTHER_TENANT = toTenantId('22222222-2222-4222-8222-222222222222');

type Method =
  | 'createPending'
  | 'findById'
  | 'markReady'
  | 'markDeleting'
  | 'claimAbandoned'
  | 'listReady'
  | 'deleteById';

const outage = (): InfrastructureAppError =>
  infrastructureError('media.persistence_failed', 'The database is down.');

/** Every row of every tenant in one map, matched on (id, tenant) exactly like the real table. */
export class InMemoryMediaAssetRepository implements MediaAssetRepository {
  readonly rows = new Map<string, MediaAsset>();
  private readonly failures = new Map<Method, number>();

  /** Makes the next `times` calls of one method fail, like a database outage. */
  failNext(method: Method, times = 1): void {
    this.failures.set(method, times);
  }

  private run<T>(method: Method, body: () => T): AppResultAsync<T, InfrastructureAppError> {
    const left = this.failures.get(method) ?? 0;
    if (left > 0) {
      this.failures.set(method, left - 1);
      return errAsync(outage());
    }
    return okAsync(body());
  }

  createPending(
    input: NewPendingAsset,
    quota: PendingQuota,
  ): AppResultAsync<MediaAsset, ConflictAppError | InfrastructureAppError> {
    const open = [...this.rows.values()].filter(
      (row) =>
        row.tenantId === input.tenantId &&
        row.status === 'pending' &&
        row.uploadExpiresAt.getTime() > quota.now.getTime(),
    ).length;
    if (open >= quota.maxOpen) {
      return errAsync(mediaTooManyPending());
    }
    return this.run('createPending', () => {
      const id = toMediaAssetId(randomUUID());
      const now = new Date();
      const asset: MediaAsset = {
        id,
        tenantId: input.tenantId,
        objectKey: mediaObjectKey(input.tenantId, id),
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        byteSize: input.byteSize,
        visibility: input.visibility,
        status: 'pending',
        createdBy: input.createdBy,
        uploadExpiresAt: input.uploadExpiresAt,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.set(id, asset);
      return asset;
    });
  }

  private owned(id: MediaAssetId, tenantId: TenantId): MediaAsset | null {
    const row = this.rows.get(id);
    return row?.tenantId === tenantId ? row : null;
  }

  findById(id: MediaAssetId, tenantId: TenantId) {
    return this.run('findById', () => this.owned(id, tenantId));
  }

  markReady(id: MediaAssetId, tenantId: TenantId, now: Date) {
    return this.run('markReady', () => {
      const row = this.owned(id, tenantId);
      if (row?.status !== 'pending') {
        return null;
      }
      const ready: MediaAsset = { ...row, status: 'ready', updatedAt: now };
      this.rows.set(id, ready);
      return ready;
    });
  }

  markDeleting(id: MediaAssetId, tenantId: TenantId, now: Date) {
    return this.run('markDeleting', () => {
      const row = this.owned(id, tenantId);
      if (!row) {
        return null;
      }
      const deleting: MediaAsset = { ...row, status: 'deleting', updatedAt: now };
      this.rows.set(id, deleting);
      return deleting;
    });
  }

  claimAbandoned({ tenantId, now, staleBefore, limit }: AbandonedClaim) {
    return this.run('claimAbandoned', () => {
      const claimed = [...this.rows.values()]
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            ((row.status === 'pending' && row.uploadExpiresAt.getTime() <= now.getTime()) ||
              (row.status === 'deleting' && row.updatedAt.getTime() <= staleBefore.getTime())),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, limit)
        .map((row): MediaAsset => ({ ...row, status: 'deleting', updatedAt: now }));
      for (const row of claimed) {
        this.rows.set(row.id, row);
      }
      return claimed;
    });
  }

  listReady(
    tenantId: TenantId,
    page: PageRequest,
    { visibility, search, sort = DEFAULT_MEDIA_SORT }: MediaListFilter = {},
  ): AppResultAsync<Page<MediaAsset>, InfrastructureAppError> {
    const text = search?.trim().toLowerCase() ?? '';
    const sign = sort.direction === 'asc' ? 1 : -1;
    const compare = (a: MediaAsset, b: MediaAsset): number =>
      sort.field === 'name'
        ? a.originalFilename.localeCompare(b.originalFilename)
        : a.createdAt.getTime() - b.createdAt.getTime();
    return this.run('listReady', () => {
      const all = [...this.rows.values()]
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            row.status === 'ready' &&
            (visibility === undefined || row.visibility === visibility) &&
            row.originalFilename.toLowerCase().includes(text),
        )
        .sort((a, b) => sign * compare(a, b) || a.id.localeCompare(b.id));
      const start = offsetOf(page);
      return toPage(all.slice(start, start + page.pageSize), all.length, page);
    });
  }

  deleteById(id: MediaAssetId, tenantId: TenantId) {
    return this.run('deleteById', () => {
      if (this.owned(id, tenantId)) {
        this.rows.delete(id);
      }
    });
  }
}

export class StubUsageRepository implements MediaUsageRepository {
  referenced = new Set<string>();
  fail = false;

  isReferenced(
    _tenantId: TenantId,
    assetId: MediaAssetId,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return this.fail ? errAsync(outage()) : okAsync(this.referenced.has(assetId));
  }
}

export class RecordingMediaAuditLog implements MediaAuditLog {
  readonly events: MediaEvent[] = [];
  record(event: MediaEvent): void {
    this.events.push(event);
  }
  types(): string[] {
    return this.events.map((event) => event.type);
  }
}

export const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3, 4,
]);
export const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5,
]);
export const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');

export interface MediaWorld {
  readonly rateLimiter: RateLimiter;
  /** The website the actor of this world works in. */
  readonly websiteId: string;
  readonly assets: InMemoryMediaAssetRepository;
  readonly store: InMemoryObjectStore;
  readonly usage: StubUsageRepository;
  readonly audit: RecordingMediaAuditLog;
  readonly clock: ManualClock;
  readonly requestUpload: RequestMediaUpload;
  readonly completeUpload: CompleteMediaUpload;
  readonly deleteAsset: DeleteMediaAsset;
  readonly listAssets: ListMediaAssets;
  readonly getReadUrl: GetMediaReadUrl;
}

/** The use cases of one actor in one world. Several actors share a world by reusing its parts. */
export function mediaWorld(
  actor: Actor | null,
  parts: Partial<
    Pick<MediaWorld, 'assets' | 'store' | 'usage' | 'audit' | 'clock' | 'rateLimiter'>
  > = {},
): MediaWorld {
  const clock = parts.clock ?? new ManualClock(new Date('2026-10-18T10:00:00.000Z'));
  const store = parts.store ?? new InMemoryObjectStore({ clock });
  const assets = parts.assets ?? new InMemoryMediaAssetRepository();
  const usage = parts.usage ?? new StubUsageRepository();
  const audit = parts.audit ?? new RecordingMediaAuditLog();
  const rateLimiter = parts.rateLimiter ?? createTestRateLimiter(clock);
  const deps: MediaDependencies = {
    access: accessFor(actor),
    assets,
    usage,
    audit,
    clock,
    rateLimiter,
    store,
  };
  return {
    websiteId: actor?.tenantId ?? TENANT,
    rateLimiter,
    assets,
    store,
    usage,
    audit,
    clock,
    requestUpload: new RequestMediaUpload(deps),
    completeUpload: new CompleteMediaUpload(deps),
    deleteAsset: new DeleteMediaAsset(deps),
    listAssets: new ListMediaAssets(deps),
    getReadUrl: new GetMediaReadUrl(deps),
  };
}

export const photo = (
  overrides: Partial<{
    websiteId: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    visibility: string;
  }> = {},
) => ({
  websiteId: TENANT as string,
  fileName: 'town-hall.png',
  contentType: 'image/png',
  byteSize: PNG.byteLength,
  visibility: 'public',
  ...overrides,
});

/** Request + client upload + the stored object, so a test can start from "an asset exists". */
export async function uploadedAsset(
  world: MediaWorld,
  overrides: Parameters<typeof photo>[0] = {},
  bytes: Uint8Array = PNG,
) {
  const requested = (
    await world.requestUpload.execute(photo({ websiteId: world.websiteId, ...overrides }))
  )._unsafeUnwrap();
  world.store.simulateClientUpload({ kind: 'http-put', ...requested.upload }, { body: bytes });
  return requested;
}
