'use client';

import { useState, useTransition } from 'react';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { applyMigrationAction } from '../actions/apply-migration-action';
import { messageKeyForError } from '../messages/message-keys';
import {
  countUnresolvedNodes,
  hasInvalidChoice,
  toResolutionsInput,
} from '../resolutions/resolution-choices';

import type { MigrationPlanDto, ApplyMigrationResultDto } from '../dto/migration-dto';
import type { MessageKey } from '../messages/message-keys';
import type { ChoiceMap, ConflictChoice } from '../resolutions/resolution-choices';

/** Pages of the review drawn at first and with each "show more": a website with many pages stays readable. */
const REVIEW_PAGES_STEP = 5;

export interface MigrationReviewOptions {
  readonly websiteId: string;
  readonly migrationId: string;
  readonly plan: MigrationPlanDto;
  readonly onApplied: (result: ApplyMigrationResultDto) => void;
}

/**
 * The state of reviewing a proposal: the choices made so far, how much of the review is drawn and the
 * apply call. The plan itself is server state and is never edited here, only answered.
 */
export function useMigrationReview({
  websiteId,
  migrationId,
  plan,
  onApplied,
}: MigrationReviewOptions) {
  const [isPending, startTransition] = useTransition();
  const [choices, setChoices] = useState<ChoiceMap>({});
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [visibleCount, setVisibleCount] = useState(REVIEW_PAGES_STEP);
  // Choices not yet applied are work a link or a closed tab would throw away.
  useReportUnsavedChanges(Object.keys(choices).length > 0);

  // Pages that need a decision come first; the choices live here, so pages not drawn yet lose nothing.
  const reviewPages = plan.pages
    .filter((page) => page.nodes.some((node) => node.status !== 'unchanged'))
    .sort(
      (a, b) =>
        Number(
          b.nodes.some((node) => node.status !== 'upgradable' && node.status !== 'unchanged'),
        ) -
        Number(a.nodes.some((node) => node.status !== 'upgradable' && node.status !== 'unchanged')),
    );

  function handleChoose(key: string, choice: ConflictChoice) {
    setChoices((current) => ({ ...current, [key]: choice }));
  }

  function handleShowMore() {
    setVisibleCount((current) => current + REVIEW_PAGES_STEP);
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

  return {
    isPending,
    choices,
    errorKey,
    visiblePages: reviewPages.slice(0, visibleCount),
    hiddenCount: Math.max(0, reviewPages.length - visibleCount),
    unresolvedCount: countUnresolvedNodes(plan, choices),
    isBlocked: hasInvalidChoice(choices),
    hasApplicableUpdates: plan.counts.upgradable > 0 || plan.counts.needs_review > 0,
    handleChoose,
    handleShowMore,
    handleApply,
  };
}
