import 'server-only';
import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { getRateLimiter } from '@lib/rate-limit';
import { getObjectStore } from '@lib/storage/server';
import { once } from '@lib/utils';

import { CompleteMediaUpload } from './application/commands/complete-media-upload';
import { DeleteMediaAsset } from './application/commands/delete-media-asset';
import { RequestMediaUpload } from './application/commands/request-media-upload';
import { GetMediaReadUrl } from './application/queries/get-media-read-url';
import { ListMediaAssets } from './application/queries/list-media-assets';
import { resolvePublicMediaUrl } from './application/services/resolve-public-media-url';
import { AuthMediaAccess } from './infrastructure/access/auth-media-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerMediaAuditLog,
} from './infrastructure/audit/logger-media-audit-log';
import { PrismaMediaAssetRepository } from './infrastructure/prisma/prisma-media-asset.repository';
import { PrismaMediaUsageRepository } from './infrastructure/prisma/prisma-media-usage.repository';

import type { MediaDependencies } from './application/media-dependencies';

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerMediaAuditLog, {
  source: 'media',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

/**
 * The module's composition root: the one file that knows both the application use cases and
 * their infrastructure adapters. Presentation and framework entry points reach use cases only
 * through here, so they never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error. Like auth and audit, dependencies and use cases are
 * process singletons built only when first requested: building the app needs no storage
 * configuration. The access adapter delegates the website's authority to auth.
 */
const getDependencies = once<MediaDependencies>(() => ({
  access: new AuthMediaAccess(getAuthQueries, getAccessControl()),
  assets: new PrismaMediaAssetRepository(),
  usage: new PrismaMediaUsageRepository(),
  audit: auditLog,
  clock: systemClock,
  rateLimiter: getRateLimiter(),
  store: getObjectStore(),
}));

/** Commands authorize the named website themselves and record their outcome in the audit trail. */
export const getMediaCommands = once(() => {
  const dependencies = getDependencies();
  return {
    requestUpload: new RequestMediaUpload(dependencies),
    completeUpload: new CompleteMediaUpload(dependencies),
    deleteAsset: new DeleteMediaAsset(dependencies),
  } as const;
});

export const getMediaQueries = once(() => {
  const dependencies = getDependencies();
  return {
    listAssets: new ListMediaAssets(dependencies),
    getReadUrl: new GetMediaReadUrl(dependencies),
  } as const;
});

/**
 * The public address of a website's file, for rendering. Pure (no I/O), so it is cheap to call
 * once per image on every page render.
 */
export function mediaPublicUrl(websiteId: string, assetId: string): string | null {
  return resolvePublicMediaUrl(getObjectStore(), websiteId, assetId);
}

/** Whether files can be uploaded at all: storage is configured with a bucket for public files. */
export function mediaUploadsAvailable(): boolean {
  return getObjectStore().supports('public');
}
