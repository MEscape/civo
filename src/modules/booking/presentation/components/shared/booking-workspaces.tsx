import { ArrowRight, Calendar } from '@components/icons/icons';
import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Alert } from '@components/ui/alert';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';

import { BookingEmptyState } from './booking-empty-state';

interface BookingWorkspacesProps {
  readonly locale: Locale;
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly isTruncated: boolean;
}

interface BookingWorkspacesPanelProps {
  readonly locale: Locale;
  readonly websites: BookingWorkspacesProps['websites'];
}

/** The workspaces a person works in as a table, each with its way in: the hub's content. */
async function BookingWorkspacesPanel({ locale, websites }: BookingWorkspacesPanelProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <DataPanel title={t('workspace.hubName')}>
      <ResponsiveTable
        label={t('workspace.hubTitle')}
        rows={websites}
        rowKey={({ id }) => id}
        density="compact"
        columns={[
          {
            id: 'name',
            label: t('workspace.hubName'),
            isTitle: true,
            // The name leads in, like a website's name does in the websites table: the same link, underlined on hover.
            cell: ({ id, name }) => (
              <span className="flex items-center gap-2">
                <Calendar className="size-4 text-copy-muted" aria-hidden="true" />
                <Link
                  href={bookingRoutes.admin(id)}
                  className="rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {name}
                </Link>
              </span>
            ),
          },
          {
            id: 'open',
            label: t('workspace.hubOpen'),
            isAction: true,
            cell: ({ id, name }) => (
              <div className="flex justify-end gap-1">
                <Link
                  href={bookingRoutes.admin(id)}
                  aria-label={t('workspace.openNamed', { name })}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  {t('workspace.hubOpen')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            ),
          },
        ]}
        state={{
          kind: 'ready',
          empty: (
            <BookingEmptyState
              icon={<Calendar aria-hidden="true" />}
              title={t('workspace.hubEmpty')}
              description={t('workspace.hubEmptyDescription')}
            />
          ),
        }}
      />
    </DataPanel>
  );
}

/** Booking is reachable directly; a workspace names the tenant without requiring website administration access. */
export async function BookingWorkspaces({ locale, websites, isTruncated }: BookingWorkspacesProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('workspace.hubTitle')}
        description={t('workspace.hubDescription')}
      />
      {isTruncated && <Alert variant="warning">{t('setup.truncated')}</Alert>}
      <BookingWorkspacesPanel locale={locale} websites={websites} />
    </AdminPage>
  );
}
