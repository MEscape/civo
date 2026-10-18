import { MemberOverviewCard, getAuthQueries } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { orNull } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

/** The people of the website; only for those who may see its members, and only while there are accounts. */
export async function PeopleBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.maySection('users')) {
    return null;
  }
  const summary = await orNull(getAuthQueries().getMemberSummary.execute());

  return summary === null ? null : (
    <MemberOverviewCard
      locale={locale}
      summary={summary}
      usersHref={websiteRoutes.users(websiteId)}
    />
  );
}
