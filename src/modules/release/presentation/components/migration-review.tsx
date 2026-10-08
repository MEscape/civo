'use client';

import { useId, useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { applyMigrationAction } from '../actions/apply-migration-action';
import { messageKeyForError } from '../messages/message-keys';
import {
  countUnresolvedNodes,
  hasInvalidChoice,
  toResolutionsInput,
} from '../resolutions/resolution-choices';

import { NodeMigrationItem } from './node-migration-item';
import { PagePathLabel } from './page-path-label';

import type { MigrationPlanDto } from '../dto/migration-plan-dto';
import type { ApplyMigrationResultDto } from '../dto/migration-result-dto';
import type { MessageKey } from '../messages/message-keys';
import type { ChoiceMap, ConflictChoice } from '../resolutions/resolution-choices';

export interface MigrationReviewProps {
  readonly websiteId: string;
  readonly migrationId: string;
  readonly plan: MigrationPlanDto;
  readonly onApplied: (result: ApplyMigrationResultDto) => void;
}

/**
 * Review and apply a proposal. The choices are local interaction state; the
 * plan itself is server state and is never edited here, only answered.
 * Nodes without a complete set of choices are skipped by the server and
 * stay as they were, so leaving a conflict open is safe.
 */
export function MigrationReview({ websiteId, migrationId, plan, onApplied }: MigrationReviewProps) {
  const t = useTranslations('release');
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [choices, setChoices] = useState<ChoiceMap>({});
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const reviewPages = plan.pages.filter((page) =>
    page.nodes.some((node) => node.status !== 'unchanged'),
  );
  const unresolvedCount = countUnresolvedNodes(plan, choices);
  const isBlocked = hasInvalidChoice(choices);

  function handleChoose(key: string, choice: ConflictChoice) {
    setChoices((current) => ({ ...current, [key]: choice }));
  }

  function handleApply() {
    setErrorKey(null);
    startTransition(async () => {
      const result = await applyMigrationAction({
        websiteId,
        migrationId,
        resolutions: toResolutionsInput(plan, choices),
      });
      if (!result.ok) {
        setErrorKey(messageKeyForError(result.error));
        return;
      }
      onApplied(result.data);
    });
  }

  return (
    <div className="space-y-6" aria-busy={isPending}>
      {reviewPages.map((page) => {
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
                    choices={choices}
                    isDisabled={isPending}
                    onChoose={handleChoose}
                  />
                ))}
            </ul>
          </section>
        );
      })}

      {unresolvedCount > 0 && (
        <p role="status" className="text-sm text-copy-muted">
          {t('migration.review.unresolvedNote', { count: unresolvedCount })}
        </p>
      )}

      <FieldMessage
        id={`${id}-error`}
        message={errorKey === null ? undefined : t(errorKey)}
        className="rounded-token border border-danger px-4 py-3 text-sm"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={isPending || isBlocked} onClick={handleApply}>
          {isPending && <Spinner className="mr-2" aria-hidden="true" />}
          {isPending ? t('migration.review.applying') : t('migration.review.apply')}
        </Button>
        <p className="text-xs text-copy-muted">{t('migration.review.applyNote')}</p>
      </div>
    </div>
  );
}
