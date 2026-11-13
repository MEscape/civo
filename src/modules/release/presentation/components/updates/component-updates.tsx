import { UploadCloud } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ProcessSteps } from '@components/shared/process-steps';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { Page } from '@lib/pagination';

import { ComponentUpdatesTable } from './component-updates-table';
import { MigrationHistoryTable } from './migration-history-table';
import { MigrationPanel } from './migration-panel';
import { UpdatesSummary } from './updates-summary';

import type { MigrationSummaryView } from '../../../application/contracts/migration-views';
import type { PublicationStatusView } from '../../../application/contracts/publication-views';

export interface ComponentUpdatesProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** One page of the earlier updates, newest first. */
  readonly history: Page<MigrationSummaryView>;
  /** What the live release holds against today's components. */
  readonly status: PublicationStatusView;
  /** Checking and applying need the publish permission; without it only the state and the history are drawn. */
  readonly mayRun: boolean;
  readonly mayEditPages?: boolean;
  /** The address of a page of the history, keeping the tab. */
  readonly hrefFor: (page: number) => string;
}

/**
 * Component updates of the live website, laid out like the release history: how it works, then
 * one panel with the state and the components that have something to update, and the history
 * of earlier updates. Applying writes new drafts; the live site is never touched, the result is
 * reviewed in the builder and published as usual.
 */
export async function ComponentUpdates({
  locale,
  websiteId,
  history,
  status,
  mayRun,
  mayEditPages = false,
  hrefFor,
}: ComponentUpdatesProps) {
  const t = await getTranslations({ locale, namespace: 'release' });
  const { componentUpdates: updates, checkedAt } = status;

  return (
    <div className="space-y-6">
      <ProcessSteps
        label={t('updates.flow.label')}
        steps={[
          {
            title: t('updates.flow.propose.title'),
            description: t('updates.flow.propose.description'),
          },
          {
            title: t('updates.flow.review.title'),
            description: t('updates.flow.review.description'),
          },
          {
            title: t('updates.flow.publish.title'),
            description: t('updates.flow.publish.description'),
          },
        ]}
      />
      {updates === null ? (
        <DataPanel title={t('updates.panelTitle')} description={t('updates.panelDescription')}>
          <EmptyState
            icon={<UploadCloud className="size-6" aria-hidden="true" />}
            title={t('migration.panel.needLive')}
            className="py-10"
          />
        </DataPanel>
      ) : (
        <MigrationPanel
          websiteId={websiteId}
          canReview={mayRun && updates.available > 0}
          checkedAt={checkedAt.toISOString()}
        >
          <UpdatesSummary updates={updates} />
          {updates.components.length > 0 && (
            <ComponentUpdatesTable
              components={updates.components}
              websiteId={websiteId}
              mayEditPages={mayEditPages}
            />
          )}
        </MigrationPanel>
      )}
      <MigrationHistoryTable locale={locale} history={history} hrefFor={hrefFor} />
    </div>
  );
}
