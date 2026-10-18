import { AuditDigestCard } from '@modules/audit';
import { websiteQueries, websiteRoutes } from '@modules/website';

import { loadAuditEventLabels } from '@/app/_lib/audit-event-labels';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

/** What was recorded lately across every module, for those who may read the audit log. */
export async function AuditBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.maySection('audit')) {
    return null;
  }
  const digest = await orFail(websiteQueries.getAuditDigest.execute(websiteId));
  const [names, eventLabels] = await Promise.all([
    loadMemberNames(digest.recent.map((entry) => entry.actorId)),
    loadAuditEventLabels(locale, digest.recent),
  ]);

  return (
    <AuditDigestCard
      locale={locale}
      digest={digest}
      auditHref={websiteRoutes.audit(websiteId)}
      eventLabels={eventLabels}
      names={names}
    />
  );
}
