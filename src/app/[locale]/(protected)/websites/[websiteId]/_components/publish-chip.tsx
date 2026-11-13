import { loadPublicationStatus, PublishStatus } from '@modules/release';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { orNull } from '@lib/errors/or-null';

import { getWebsiteAccess } from '@/app/_lib/website-access';

/**
 * Whether what the editor shows is what visitors see, on every page of the website. It streams
 * in beside the sections, so it never holds a page back, and it shares the page's own read of the
 * same status within a request. Whoever may not read releases, or when the status cannot be
 * read, sees nothing.
 */
export async function PublishChip({
  params,
}: {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const access = await getWebsiteAccess();
  if (access.tenantId !== websiteId || !access.may('release.read')) {
    return null;
  }
  const status = await orNull(loadPublicationStatus(websiteId));

  return status === null ? null : (
    <I18nProvider locale={locale} namespaces={['release']}>
      <PublishStatus
        locale={locale}
        websiteId={websiteId}
        status={status}
        mayPublish={access.may('release.publish')}
      />
    </I18nProvider>
  );
}
