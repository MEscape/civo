import type { Locale } from '@i18n';

import { orNull } from '@lib/errors/or-null';

import { getAuditQueries } from '../../composition';
import { loadAuditEventLabels } from '../loaders/load-audit-event-labels';

import { AuditDigestCard } from './audit-digest-card';

interface OverviewAuditProps {
  readonly websiteId: string;
  readonly locale: Locale;
  readonly auditHref: string;
}

/** What was recorded lately across every module, for those who may read the audit log. */
export async function AuditOverview({ websiteId, locale, auditHref }: OverviewAuditProps) {
  const queries = getAuditQueries();
  const digest = await orNull(queries.getAuditDigest.execute(websiteId));
  if (digest === null) {
    return null;
  }
  const [members, eventLabels] = await Promise.all([
    orNull(
      queries.resolveMemberNames(
        digest.recent.flatMap((entry) => (entry.actorId === null ? [] : [entry.actorId])),
      ),
    ),
    loadAuditEventLabels(locale, digest.recent),
  ]);

  return (
    <AuditDigestCard
      locale={locale}
      digest={digest}
      auditHref={auditHref}
      eventLabels={eventLabels}
      names={
        members === null
          ? null
          : Object.fromEntries(members.names.map((member) => [member.id, member.name]))
      }
    />
  );
}
