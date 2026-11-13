import type { ReactNode } from 'react';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { mapRoutes } from '../../routes';

interface MapsAdminPageProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly title: string;
  readonly description?: string | undefined;
  /** The page's main actions, at the heading's far edge; they wrap below on a narrow screen. */
  readonly actions?: ReactNode;
  /** The map's own name below "Maps"; absent on the list itself. */
  readonly crumb?: string | undefined;
  readonly children: ReactNode;
}

/** The shared admin frame plus the unsaved-work boundary of the map editor. */
export async function MapsAdminPage({
  locale,
  websiteId,
  title,
  description,
  actions,
  crumb,
  children,
}: MapsAdminPageProps) {
  const t = await getTranslations({ locale, namespace: 'map' });
  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['map']}>
        <AdminPageHeader
          title={title}
          description={description}
          actions={actions}
          breadcrumbLabel={t('management.breadcrumb')}
          crumbs={
            crumb === undefined
              ? undefined
              : [
                  { label: t('management.title'), href: mapRoutes.list(websiteId) },
                  { label: crumb },
                ]
          }
        />
        <UnsavedChangesProvider
          title={t('management.leaveTitle')}
          description={t('management.leaveDescription')}
          confirmLabel={t('management.leave')}
          cancelLabel={t('management.stay')}
        >
          {children}
        </UnsavedChangesProvider>
      </I18nProvider>
    </AdminPage>
  );
}
