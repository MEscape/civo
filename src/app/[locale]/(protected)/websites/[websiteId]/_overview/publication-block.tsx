import { PublicationBanner } from '@modules/release';

import { I18nProvider } from '@components/providers/i18n-provider';

import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';

import type { BlockProps } from './block-props';

export async function PublicationBlock({ websiteId, locale }: BlockProps) {
  const access = await getWebsiteAccess();
  if (!access.may('release.read')) {
    return null;
  }
  const status = await orFail(loadPublicationStatus(websiteId));

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <PublicationBanner
        locale={locale}
        websiteId={websiteId}
        status={status}
        mayPublish={access.may('release.publish')}
        mayUpdate={access.may('release.publish')}
      />
    </I18nProvider>
  );
}
