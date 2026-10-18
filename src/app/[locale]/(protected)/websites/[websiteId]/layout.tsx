import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { PublishStatus } from '@modules/release';
import { WebsiteSwitcher, websiteRoutes } from '@modules/website';

import { AppNav } from '@components/layout/app-nav';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { loadWebsite } from '@/app/_lib/load-website';
import { orNull } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';
import type { WebsiteSectionKey } from '@/app/_lib/website-access';
import { loadSwitchableWebsites } from '@/app/_lib/website-switcher';

interface LayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

const SECTION_LABELS = {
  overview: 'nav.overview',
  builder: 'nav.builder',
  bookings: 'nav.bookings',
  releases: 'nav.releases',
  data: 'nav.data',
  settings: 'nav.settings',
  users: 'nav.users',
  audit: 'nav.audit',
} as const satisfies Record<WebsiteSectionKey, string>;

/** Rarely visited administration sits behind one dropdown, so the everyday areas stay tabs. */
const ADMINISTRATION: ReadonlySet<WebsiteSectionKey> = new Set(['settings', 'users', 'audit']);

/**
 * The website's name and the way between its sections, as one line. A reader
 * who may not open the website gets no name (the page itself answers with
 * not found), and a section appears only for people who may use it.
 */
async function WebsiteNav({ params }: Pick<LayoutProps, 'params'>) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, website, access] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    loadWebsite(websiteId),
    getWebsiteAccess(),
  ]);

  // A tenant is its website: whoever is not working in this one has nothing here.
  if (access.tenantId !== websiteId) {
    notFound();
  }

  const canListAll = access.may('website.list.all');
  const switchable = await loadSwitchableWebsites(canListAll);
  // With other websites to go to, the name opens them; alone, it is just the name.
  const hasSwitcher = website.isOk() && switchable.websites.length > 1;

  return (
    <>
      {hasSwitcher && (
        <I18nProvider locale={locale} namespaces={['website']}>
          <WebsiteSwitcher
            current={{ id: websiteId, name: website.value.name }}
            websites={switchable.websites}
            keepSection={canListAll}
            offerList={canListAll}
          />
        </I18nProvider>
      )}
      <AppNav
        variant="section"
        label={t('nav.label')}
        compactLabel={t('nav.sections')}
        moreLabel={t('nav.more')}
        links={[
          ...(website.isOk() && !hasSwitcher
            ? [{ href: websiteRoutes.detail(websiteId), label: website.value.name, isBrand: true }]
            : []),
          ...access.sections(websiteId).map(({ key, href }) => ({
            href,
            label: t(SECTION_LABELS[key]),
            isExact: key === 'overview',
            ...(ADMINISTRATION.has(key) ? { group: t('nav.administration') } : {}),
          })),
        ]}
      />
    </>
  );
}

/**
 * Whether what the editor shows is what visitors see, on every page of the
 * website. It streams in beside the sections, so it never holds a page back, and
 * it shares the page's own read of the same status within a request. Whoever
 * may not read releases, or when the status cannot be read, sees nothing.
 */
async function PublishChip({ params }: Pick<LayoutProps, 'params'>) {
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

/**
 * Every page of one website, the visual editor included, sits under this
 * bar: it names the website and stays put, so moving between the website's
 * areas never leaves the website.
 */
export default function WebsiteLayout({ children, params }: LayoutProps) {
  return (
    <>
      <div className="sticky top-app-header z-30 flex h-website-bar shrink-0 items-stretch border-b border-border bg-surface px-4">
        <Suspense fallback={<Skeleton className="my-3 h-5 w-64" />}>
          <WebsiteNav params={params} />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center pl-4">
          <Suspense fallback={null}>
            <PublishChip params={params} />
          </Suspense>
        </div>
      </div>
      {children}
    </>
  );
}
