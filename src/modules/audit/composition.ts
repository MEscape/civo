import 'server-only';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { errAsync, okAsync } from '@lib/result';
import { MS_PER_DAY, once } from '@lib/utils';

import { PruneAuditTrail } from './application/commands/prune-audit-trail';
import { GetAuditDigest } from './application/queries/get-audit-digest';
import { GetAuditTrail } from './application/queries/get-audit-trail';
import { GetAuditTrailAcrossWebsites } from './application/queries/get-audit-trail-across-websites';
import { AuditTrailRecorder } from './application/services/audit-trail-recorder';
import { auditAccessDenied } from './domain/errors/audit-errors';
import { loggerTrailAuditLog } from './infrastructure/audit/logger-trail-audit-log';
import { PrismaAuditTrailRepository } from './infrastructure/prisma/prisma-audit-trail.repository';

import type { AuditDependencies } from './application/audit-dependencies';
import type {
  AuditAccess,
  AuditReaders,
  AuditTrailSource,
  MemberNamesResolver,
} from './application/contracts/audit-views';

export type { MemberNamesResolver } from './application/contracts/audit-views';

/**
 * The module's composition root: the one file that knows both the use cases
 * and their adapters. `server-only` makes an accidental import from a Client
 * Component a build error. Dependencies, readers and writers are built lazily,
 * matching auth's composition root; importing this file does no persistence work.
 */
const getDependencies = once<AuditDependencies>(() => ({
  entries: new PrismaAuditTrailRepository(),
  clock: systemClock,
}));
const getRecorder = once(() => new AuditTrailRecorder(getDependencies()));

interface AuditQueries extends AuditReaders {
  readonly getAuditTrail: GetAuditTrail;
  readonly getAuditTrailAcrossWebsites: GetAuditTrailAcrossWebsites;
  readonly getAuditDigest: GetAuditDigest;
  readonly resolveMemberNames: MemberNamesResolver;
}

const fallbackAccess: AuditAccess = {
  authorizeWebsite: () => errAsync(auditAccessDenied()),
  listReadableWebsites: () => okAsync({ isPlatform: false, websites: [], isTruncated: false }),
};

let configured: {
  readonly access: AuditAccess;
  readonly resolveMemberNames: MemberNamesResolver | undefined;
} = {
  access: fallbackAccess,
  resolveMemberNames: undefined,
};

/**
 * Registers the access and name resolution adapter into the audit module.
 * Called by the auth module's composition root so the audit module has no dependency on auth.
 * Existing readers use the latest registration. Omitting the resolver preserves the registered one.
 * Until registration, reads fail closed and names resolve to an empty list.
 */
export function setAuditAccessAdapter(
  access: AuditAccess,
  resolveMemberNames?: MemberNamesResolver,
): void {
  configured = { access, resolveMemberNames: resolveMemberNames ?? configured.resolveMemberNames };
}

const dynamicAccess: AuditAccess = {
  authorizeWebsite: (websiteId) => configured.access.authorizeWebsite(websiteId),
  listReadableWebsites: () => configured.access.listReadableWebsites(),
};

/** Explicit readers keep their supplied access port; only absent name resolvers use registration. */
export function createAuditQueries(
  access: AuditAccess,
  resolveMemberNames?: MemberNamesResolver,
): AuditQueries {
  const readDependencies = { ...getDependencies(), access };
  return {
    getAuditTrail: new GetAuditTrail(readDependencies),
    getAuditTrailAcrossWebsites: new GetAuditTrailAcrossWebsites(readDependencies),
    getAuditDigest: new GetAuditDigest(readDependencies),
    resolveMemberNames: (memberIds: readonly string[]) =>
      (resolveMemberNames ?? configured.resolveMemberNames)?.(memberIds) ?? okAsync({ names: [] }),
  };
}

/** The audit queries every page reads the trail with; built once, on first use. */
export const getAuditQueries = once<AuditQueries>(() => createAuditQueries(dynamicAccess));

/** Compatibility facade for existing consumers; every getter uses the same lazy query set. */
export const auditQueries = {
  get getAuditTrail() {
    return getAuditQueries().getAuditTrail;
  },
  get getAuditTrailAcrossWebsites() {
    return getAuditQueries().getAuditTrailAcrossWebsites;
  },
  get getAllWebsitesAuditTrail() {
    return getAuditQueries().getAuditTrailAcrossWebsites;
  },
  get getAuditDigest() {
    return getAuditQueries().getAuditDigest;
  },
};

/**
 * A module's audit port that still writes its log lines and also keeps, in
 * the trail, the events its policy keeps. Another module's composition root
 * wraps its own log with this, the one place it wires the audit module in;
 * none of its use cases learns that the trail exists.
 */
export function withAuditTrail<E extends { readonly type: string }>(
  log: { record(event: E): void },
  source: AuditTrailSource<E['type']>,
): { record(event: E): void } {
  return {
    record(event) {
      log.record(event);
      getRecorder().record(event, source);
    },
  };
}

/**
 * Keeps the trail to its retention: once at server start, then daily. The
 * app runs as one long-lived Node.js server (`next start`), so the process's
 * own timer is the schedule; several instances deleting the same old rows is
 * harmless. A failed run is logged by the store and retried the next day.
 * `unref` lets the process exit without waiting for it.
 */
export const startAuditRetention = once((): void => {
  const pruneAuditTrail = new PruneAuditTrail({
    ...getDependencies(),
    audit: loggerTrailAuditLog,
    retentionDays: serverEnv.AUDIT_RETENTION_DAYS,
  });
  const run = () => {
    void pruneAuditTrail.execute();
  };
  run();
  setInterval(run, MS_PER_DAY).unref();
});
