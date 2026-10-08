'use client';

import { useId, useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { proposeMigrationAction } from '../actions/propose-migration-action';
import { messageKeyForError } from '../messages/message-keys';

import { ApplyResult } from './apply-result';
import { MigrationHistoryList } from './migration-history-list';
import { MigrationReview } from './migration-review';
import { PlanCounts } from './plan-counts';

import type { MigrationHistoryDto } from '../dto/migration-history-dto';
import type { MigrationProposalDto } from '../dto/migration-plan-dto';
import type { ApplyMigrationResultDto } from '../dto/migration-result-dto';
import type { MessageKey } from '../messages/message-keys';

export interface MigrationPanelProps {
  readonly websiteId: string;
  /** Loaded by the Server Component, so the list renders without a client fetch. */
  readonly history: MigrationHistoryDto;
}

/**
 * Check a published website against today's component versions, review the
 * proposed changes and apply them as new drafts. The live site is never
 * touched: the result is reviewed in the builder and published as usual.
 */
/** A proposal needs review only if something was recorded and something is out of date. */
function reviewableOf(proposal: MigrationProposalDto | null) {
  if (proposal === null) {
    return null;
  }
  const { migrationId, plan } = proposal;
  return migrationId === null || plan.isUpToDate ? null : { migrationId, plan };
}

export function MigrationPanel({ websiteId, history }: MigrationPanelProps) {
  const t = useTranslations('release');
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [proposal, setProposal] = useState<MigrationProposalDto | null>(null);
  const [result, setResult] = useState<ApplyMigrationResultDto | null>(null);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  function handleCheck() {
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
      router.refresh();
    });
  }

  function handleApplied(applied: ApplyMigrationResultDto) {
    setResult(applied);
    // An applied migration is finished; a partial one stays open for another attempt.
    if (applied.status === 'applied') {
      setProposal(null);
    }
    router.refresh();
  }

  const reviewable = reviewableOf(proposal);

  return (
    <div className="space-y-8" aria-busy={isPending}>
      <section aria-labelledby={`${id}-title`} className="space-y-4">
        <div className="space-y-1">
          <h2 id={`${id}-title`} className="text-xl font-semibold text-copy">
            {t('migration.panel.title')}
          </h2>
          <p className="text-sm text-copy-muted">{t('migration.panel.description')}</p>
        </div>

        <FieldMessage
          id={`${id}-error`}
          message={errorKey === null ? undefined : t(errorKey)}
          className="rounded-token border border-danger px-4 py-3 text-sm"
        />

        <Button type="button" disabled={isPending} onClick={handleCheck}>
          {isPending && <Spinner className="mr-2" aria-hidden="true" />}
          {isPending ? t('migration.panel.checking') : t('migration.panel.check')}
        </Button>

        {proposal?.plan.isUpToDate === true && (
          <Alert variant="info" role="status">
            <AlertDescription>{t('migration.panel.upToDate')}</AlertDescription>
          </Alert>
        )}

        {reviewable !== null && (
          <div className="space-y-4">
            <PlanCounts counts={reviewable.plan.counts} />
            <MigrationReview
              websiteId={websiteId}
              migrationId={reviewable.migrationId}
              plan={reviewable.plan}
              onApplied={handleApplied}
            />
          </div>
        )}

        {result !== null && <ApplyResult result={result} />}
      </section>

      <section aria-labelledby={`${id}-history`} className="space-y-3">
        <h2 id={`${id}-history`} className="text-xl font-semibold text-copy">
          {t('migration.history.title')}
        </h2>
        <MigrationHistoryList history={history} />
      </section>
    </div>
  );
}
