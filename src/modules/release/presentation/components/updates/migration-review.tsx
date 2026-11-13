'use client';

import { useId } from 'react';

import { Spinner } from '@components/icons/icons';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMigrationReview } from '../../hooks/use-migration-review';
import { PagePathLabel } from '../shared/page-path-label';

import { NodeMigrationItem } from './node-migration-item';

import type { MigrationReviewOptions } from '../../hooks/use-migration-review';

export type MigrationReviewProps = MigrationReviewOptions;

/**
 * Review and apply a proposal. The choices are local interaction state; the
 * plan itself is server state and is never edited here, only answered.
 * Nodes without a complete set of choices are skipped by the server and
 * stay as they were, so leaving a conflict open is safe.
 */
function ReviewChoices(props: MigrationReviewProps) {
  const t = useTranslations('release');
  const id = useId();
  const review = useMigrationReview(props);
  const { isPending, errorKey, hiddenCount, unresolvedCount, hasApplicableUpdates } = review;

  return (
    <div className="space-y-6" aria-busy={isPending}>
      {review.visiblePages.map((page) => {
        const headingId = `${id}-${page.path || 'home'}`;
        return (
          <section key={page.path} aria-labelledby={headingId} className="space-y-3">
            <h3 id={headingId} className="text-base font-semibold text-copy">
              <PagePathLabel path={page.path} />
            </h3>
            <ul className="space-y-3">
              {page.nodes
                .filter((node) => node.status !== 'unchanged')
                .map((node) => (
                  <NodeMigrationItem
                    key={node.nodeId}
                    pagePath={page.path}
                    node={node}
                    choices={review.choices}
                    isDisabled={isPending}
                    onChoose={review.handleChoose}
                  />
                ))}
            </ul>
          </section>
        );
      })}

      {hiddenCount > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={review.handleShowMore}>
          {t('migration.review.showMore', { count: hiddenCount })}
        </Button>
      )}

      {unresolvedCount > 0 && (
        <p role="status" className="text-sm text-copy-muted">
          {t('migration.review.unresolvedNote', { count: unresolvedCount })}
        </p>
      )}

      {!hasApplicableUpdates && (
        <p role="status" className="text-sm text-copy-muted">
          {t('migration.review.noApplicableUpdates')}
        </p>
      )}

      <FieldMessage
        id={`${id}-error`}
        message={errorKey === null ? undefined : t(errorKey)}
        className="rounded-token border border-danger px-4 py-3 text-sm"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending || review.isBlocked || !hasApplicableUpdates}
          onClick={review.handleApply}
        >
          {isPending && <Spinner className="mr-2" aria-hidden="true" />}
          {isPending ? t('migration.review.applying') : t('migration.review.apply')}
        </Button>
        <p className="text-xs text-copy-muted">{t('migration.review.applyNote')}</p>
      </div>
    </div>
  );
}

/** The review behind a guard: choices not yet applied are asked about before a link leaves the page. */
export function MigrationReview(props: MigrationReviewProps) {
  const t = useTranslations('release');
  return (
    <UnsavedChangesProvider
      title={t('migration.review.leave.title')}
      description={t('migration.review.leave.description')}
      confirmLabel={t('migration.review.leave.confirm')}
      cancelLabel={t('migration.review.leave.stay')}
    >
      <ReviewChoices {...props} />
    </UnsavedChangesProvider>
  );
}
