'use client';

import { useId, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { FieldMessage } from '@components/shared/field-message';
import { ProcessSteps } from '@components/shared/process-steps';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { proposeMigrationAction } from '../actions/propose-migration-action';
import { messageKeyForError } from '../messages/message-keys';

import { ApplyResult } from './apply-result';
import { ComponentList } from './component-update-list';
import { MigrationHistoryList } from './migration-history-list';
import { MigrationReview } from './migration-review';
import { PlanCounts } from './plan-counts';
import { UpdatesCheck } from './updates-check';
import { UpToDate, UpdatesSummary } from './updates-summary';

import type { PublicationStatusView } from '../../application/contracts/release-views';
import type { MigrationHistoryDto } from '../dto/migration-history-dto';
import type { MigrationProposalDto } from '../dto/migration-plan-dto';
import type { ApplyMigrationResultDto } from '../dto/migration-result-dto';
import type { MessageKey } from '../messages/message-keys';

export interface MigrationPanelProps {
  readonly websiteId: string;
  /** Loaded by the Server Component, so the list renders without a client fetch. */
  readonly history: MigrationHistoryDto;
  /** Every update ever proposed, not only this page of them. */
  readonly historyTotal: number;
  /** What the live release holds against today's components; `null` while nothing is live. */
  readonly updates: PublicationStatusView['componentUpdates'];
  /** The names people know components by, by type (of the updates and the history); a type without one is shown as it is. */
  readonly componentLabels: Readonly<Record<string, string>>;
  /** When the state above was read (ISO): it is computed on every request, so this is how fresh it is. */
  readonly checkedAt: string;
  /** Checking and applying need the publish permission; without it only the state and the history are drawn. */
  readonly mayRun: boolean;
  /** The history's page links, drawn in its footer when there is more than one page. */
  readonly pagination?: ReactNode;
}

/** A proposal needs review only if something was recorded and something is out of date. */
function reviewableOf(proposal: MigrationProposalDto | null) {
  if (proposal === null) {
    return null;
  }
  const { migrationId, plan } = proposal;
  return migrationId === null || plan.isUpToDate ? null : { migrationId, plan };
}

/**
 * Component updates of the live website, laid out like the release history:
 * how it works, then one panel with the state, the components that have
 * something to update (each opening to say what changes) and a read-only
 * refresh; the review that proposes and records a migration; and the history
 * of earlier updates. Applying writes new drafts; the live site is never
 * touched, the result is reviewed in the builder and published as usual.
 */
export function MigrationPanel({
  websiteId,
  history,
  historyTotal,
  updates,
  componentLabels,
  checkedAt,
  mayRun,
  pagination,
}: MigrationPanelProps) {
  const t = useTranslations('release');
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [proposal, setProposal] = useState<MigrationProposalDto | null>(null);
  const [result, setResult] = useState<ApplyMigrationResultDto | null>(null);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  function handleReview() {
    setErrorKey(null);
    setResult(null);
    startTransition(async () => {
      const response = await proposeMigrationAction({ websiteId });
      if (!response.ok) {
        setProposal(null);
        setErrorKey(messageKeyForError(response.error));
        return;
      }
      setProposal(response.data);
    });
  }

  function handleApplied(applied: ApplyMigrationResultDto) {
    setResult(applied);
    // An applied migration is finished; a partial one stays open for another attempt.
    if (applied.status === 'applied') {
      setProposal(null);
    }
  }

  const reviewable = reviewableOf(proposal);
  const canReview = mayRun && updates !== null && updates.available > 0 && proposal === null;

  return (
    <div className="space-y-6" aria-busy={isPending}>
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

      <FieldMessage
        id={`${id}-error`}
        message={errorKey === null ? undefined : t(errorKey)}
        className="rounded-token border border-danger px-4 py-3 text-sm"
      />

      {updates === null ? (
        <EmptyState title={t('migration.panel.needLive')} variant="outlined" className="py-10" />
      ) : (
        <DataPanel
          title={t('updates.panelTitle')}
          description={t('updates.panelDescription')}
          actions={
            <div className="flex items-center gap-2">
              <UpdatesCheck checkedAt={checkedAt} />
              {canReview && (
                <Button type="button" size="sm" disabled={isPending} onClick={handleReview}>
                  {isPending && <Spinner aria-hidden="true" />}
                  {t('migration.panel.review')}
                </Button>
              )}
            </div>
          }
        >
          {proposal === null ? (
            <>
              <UpdatesSummary updates={updates} />
              {updates.components.length > 0 && (
                <ComponentList components={updates.components} labels={componentLabels} />
              )}
            </>
          ) : (
            <div className="space-y-4 p-4">
              {reviewable === null ? (
                <UpToDate />
              ) : (
                <>
                  <PlanCounts counts={reviewable.plan.counts} />
                  <MigrationReview
                    websiteId={websiteId}
                    migrationId={reviewable.migrationId}
                    plan={reviewable.plan}
                    onApplied={handleApplied}
                  />
                </>
              )}
            </div>
          )}
        </DataPanel>
      )}

      {result !== null && <ApplyResult result={result} />}

      <MigrationHistoryList
        history={history}
        total={historyTotal}
        componentLabels={componentLabels}
        pagination={pagination}
      />
    </div>
  );
}
