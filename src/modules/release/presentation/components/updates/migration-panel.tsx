'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';

import { Spinner } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMigrationPanel } from '../../hooks/use-migration-panel';

import { ApplyResult } from './apply-result';
import { MigrationReview } from './migration-review';
import { UpdatesCheck } from './updates-check';
import { PlanCounts, UpToDate } from './updates-summary';

export interface MigrationPanelProps {
  readonly websiteId: string;
  /** Whether the actor may propose an update and something is waiting to be updated. */
  readonly canReview: boolean;
  /** When the state shown was read (ISO): it is computed on every request, so this is how fresh it is. */
  readonly checkedAt: string;
  /** The state while nothing is being reviewed: the summary and the components with something to update. */
  readonly children: ReactNode;
}

/**
 * The frame of the update state and the one place it turns interactive: a read-only refresh, the
 * review that proposes and records a migration, and what applying it did. The state itself is
 * drawn by the Server Component that mounts this and arrives as `children`.
 */
export function MigrationPanel({ websiteId, canReview, checkedAt, children }: MigrationPanelProps) {
  const t = useTranslations('release');
  const id = useId();
  const panel = useMigrationPanel({ websiteId, canReview });
  const { reviewable } = panel;

  return (
    <div className="space-y-6" aria-busy={panel.isPending}>
      <FieldMessage
        id={`${id}-error`}
        message={panel.errorKey === null ? undefined : t(panel.errorKey)}
        className="rounded-token border border-danger px-4 py-3 text-sm"
      />

      <DataPanel
        title={t('updates.panelTitle')}
        description={t('updates.panelDescription')}
        actions={
          <div className="flex items-center gap-2">
            <UpdatesCheck checkedAt={checkedAt} />
            {panel.canStartReview && (
              <Button
                type="button"
                size="sm"
                disabled={panel.isPending}
                onClick={panel.handleReview}
              >
                {panel.isPending && <Spinner aria-hidden="true" />}
                {t('migration.panel.review')}
              </Button>
            )}
          </div>
        }
      >
        {panel.proposal === null ? (
          children
        ) : (
          <div className="space-y-4 p-4">
            {reviewable === null ? (
              <UpToDate />
            ) : (
              <>
                <PlanCounts counts={reviewable.plan.counts} />
                <MigrationReview
                  key={reviewable.migrationId}
                  websiteId={websiteId}
                  migrationId={reviewable.migrationId}
                  plan={reviewable.plan}
                  onApplied={panel.handleApplied}
                />
              </>
            )}
          </div>
        )}
      </DataPanel>

      {panel.result !== null && <ApplyResult result={panel.result} />}
    </div>
  );
}
