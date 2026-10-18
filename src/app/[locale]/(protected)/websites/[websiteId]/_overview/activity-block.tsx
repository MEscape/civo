import { ReleaseActivityCard } from '@modules/release';

import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

export async function ActivityBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.may('release.read')) {
    return null;
  }
  const status = await orFail(loadPublicationStatus(websiteId));
  const authors = await loadMemberNames(status.recent.map((release) => release.publishedBy));

  return (
    <ReleaseActivityCard
      locale={locale}
      websiteId={websiteId}
      status={status}
      linkToReleases={access.maySection('releases')}
      authors={authors}
    />
  );
}
