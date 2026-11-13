import type { Clock } from '@lib/clock';

import type { AuditAccess } from '../domain/ports/audit-access.port';
import type { AuditTrailRepository } from '../domain/ports/audit-trail.repository';
import type { TrailAuditLog } from '../domain/ports/trail-audit-log.port';

/**
 * What the use cases that WRITE or prune the trail are built from. They have no reader: the trail
 * is written by modules that already authorized the action it records, and kept to its retention
 * by the platform itself. The audit module depends on no other module, so every module, the auth
 * module included, can feed it.
 */
export interface AuditDependencies {
  readonly entries: AuditTrailRepository;
  readonly clock: Clock;
}

/**
 * What every use case that READS the trail is built from. `access` decides, from the signed-in
 * reader's own memberships, which part of the trail the reader may see; the use case reads
 * nothing before it has answered.
 */
export interface AuditReadDependencies extends AuditDependencies {
  readonly access: AuditAccess;
}

/** What keeping the trail to its retention is built from. */
export interface AuditRetentionDependencies extends AuditDependencies {
  readonly audit: TrailAuditLog;
  /** How many days an entry is kept; validated configuration. */
  readonly retentionDays: number;
}
