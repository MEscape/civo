import { z } from 'zod';

import {
  AUDIT_PERIODS,
  AUDIT_SOURCES,
  DEFAULT_AUDIT_PERIOD,
} from '../../application/contracts/audit-views';

import type { AuditFilter, AuditPageOptions } from '../../application/contracts/audit-views';

/** An event type as modules name them: `area.event`, lower case. */
const EVENT_TYPE_PATTERN = /^[a-z_]+(?:\.[a-z_]+)+$/;
const EVENT_TYPE_MAX = 80;
const ACTOR_ID_MAX = 128;

const MEMBER_PREFIX = 'member:';

/**
 * The audit page's address parameters. Untrusted and possibly repeated, so
 * every one falls back instead of failing: a hand-edited address shows the
 * unfiltered trail, not an error page.
 */
export const auditParamsSchema = z.object({
  website: z.string().max(ACTOR_ID_MAX).optional().catch(undefined),
  area: z.enum(AUDIT_SOURCES).optional().catch(undefined),
  event: z.string().max(EVENT_TYPE_MAX).regex(EVENT_TYPE_PATTERN).optional().catch(undefined),
  who: z
    .union([
      z.enum(['visitor', 'system']),
      z
        .string()
        .startsWith(MEMBER_PREFIX)
        .max(MEMBER_PREFIX.length + ACTOR_ID_MAX),
    ])
    .optional()
    .catch(undefined),
  period: z.enum(AUDIT_PERIODS).optional().catch(undefined),
  warnings: z.literal('1').optional().catch(undefined),
  page: z.string().optional().catch(undefined),
  pageSize: z.string().optional().catch(undefined),
});

/** The "who" choice as the address and the filter form carry it. */
export function whoValueOf(actor: AuditFilter['actor']): string | undefined {
  if (actor === null) {
    return undefined;
  }
  return actor.kind === 'member' ? `${MEMBER_PREFIX}${actor.id}` : actor.kind;
}

function actorOf(who: string | undefined): AuditFilter['actor'] {
  if (who === undefined) {
    return null;
  }
  if (who === 'visitor' || who === 'system') {
    return { kind: who };
  }
  const id = who.slice(MEMBER_PREFIX.length);
  return id === '' ? null : { kind: 'member', id };
}

/** The filter and the page an address asks for. */
export function parseAuditParams(raw: Readonly<Record<string, string | string[] | undefined>>): {
  readonly filter: AuditFilter;
  readonly page: AuditPageOptions;
} {
  const params = auditParamsSchema.parse(raw);
  return {
    filter: {
      websiteId: params.website === undefined || params.website === '' ? null : params.website,
      source: params.area ?? null,
      type: params.event ?? null,
      actor: actorOf(params.who),
      period: params.period ?? DEFAULT_AUDIT_PERIOD,
      onlyWarnings: params.warnings === '1',
    },
    page: { page: params.page, pageSize: params.pageSize },
  };
}

/** The address parameters of a filter, leaving out what is the default; the page always starts again. */
export function auditParamsOf(filter: AuditFilter): Readonly<Record<string, string | undefined>> {
  return {
    website: filter.websiteId ?? undefined,
    area: filter.source ?? undefined,
    event: filter.type ?? undefined,
    who: whoValueOf(filter.actor),
    period: filter.period === DEFAULT_AUDIT_PERIOD ? undefined : filter.period,
    warnings: filter.onlyWarnings ? '1' : undefined,
  };
}
