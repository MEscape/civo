import { notFound } from 'next/navigation';

import { getAuthQueries } from '@modules/auth';
import { getWebsiteQueries, WebsiteSwitcher } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

/**
 * The website's name and the way between its sections, as one line. A reader who may not open
 * the website gets no name (the page itself answers with not found), and a section appears only
 * for people who may use it.
 */
export async function WebsiteNav({
  params,
}: {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, website, access] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    orFail(getWebsiteQueries().getWebsiteById.execute(websiteId)),
    getWebsiteAccess(),
  ]);

  // A tenant is its website: whoever is not working in this one has nothing here.
  if (access.tenantId !== websiteId) {
    notFound();
  }

  const switchable = await orFail(getAuthQueries().listAccessibleWebsites.execute('website.read'));

  return (
    <>
      <I18nProvider locale={locale} namespaces={['website']}>
        <WebsiteSwitcher
          current={{ id: websiteId, name: website.name }}
          websites={switchable.websites}
          keepSection={access.may('website.list.all')}
          offerList
          isTruncated={switchable.isTruncated}
        />
      </I18nProvider>
      <AppNav
        variant="section"
        label={t('nav.label')}
        compactLabel={t('nav.sections')}
        moreLabel={t('nav.more')}
        links={[
          ...access.sections(websiteId).map(({ key, href, label, isAdministration }) => ({
            href,
            label: t(label),
            isExact: key === 'overview',
            ...(isAdministration ? { group: t('nav.administration') } : {}),
          })),
        ]}
      />
    </>
  );
}
