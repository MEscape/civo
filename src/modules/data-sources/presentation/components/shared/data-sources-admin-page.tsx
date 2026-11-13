import type { ReactNode } from 'react';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import type { AdminCrumb } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { dataSourceRoutes } from '../../routes';

interface DataSourcesAdminPageProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly title: string;
  readonly description?: string | undefined;
  /** The page's main action (a "connect" button), at the heading's far edge; it wraps below on a narrow screen. */
  readonly actions?: ReactNode;
  /** Where the page sits below the list of sources; the last has no address, it is where the person is. */
  readonly crumbs?: readonly AdminCrumb[] | undefined;
  readonly children: ReactNode;
}

/** The shared admin frame plus the unsaved-work boundary of the data-source forms. */
export async function DataSourcesAdminPage({
  locale,
  websiteId,
  title,
  description,
  actions,
  crumbs,
  children,
}: DataSourcesAdminPageProps) {
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['dataSources']}>
        <AdminPageHeader
          title={title}
          description={description}
          actions={actions}
          breadcrumbLabel={t('navigation.breadcrumb')}
          crumbs={
            crumbs === undefined
              ? undefined
              : [{ label: t('panel.title'), href: dataSourceRoutes.sources(websiteId) }, ...crumbs]
          }
        />
        <UnsavedChangesProvider
          title={t('leave.title')}
          description={t('leave.description')}
          confirmLabel={t('leave.confirm')}
          cancelLabel={t('leave.stay')}
        >
          {children}
        </UnsavedChangesProvider>
      </I18nProvider>
    </AdminPage>
  );
}
