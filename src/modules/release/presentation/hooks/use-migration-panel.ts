'use client';

import { useState, useTransition } from 'react';

import { proposeMigrationAction } from '../actions/propose-migration-action';
import { messageKeyForError } from '../messages/message-keys';

import type { MigrationProposalDto, ApplyMigrationResultDto } from '../dto/migration-dto';
import type { MessageKey } from '../messages/message-keys';

interface MigrationPanelOptions {
  readonly websiteId: string;
  /** Whether the actor may propose an update and something is waiting to be updated. */
  readonly canReview: boolean;
}

/** A proposal needs review only if something was recorded and something is out of date. */
function reviewableOf(proposal: MigrationProposalDto | null) {
  if (proposal === null) {
    return null;
  }
  const { migrationId, plan } = proposal;
  return migrationId === null || plan.isUpToDate ? null : { migrationId, plan };
}

/** The proposal being reviewed, the result of the last apply and the error of the last proposal. */
export function useMigrationPanel({ websiteId, canReview }: MigrationPanelOptions) {
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

  return {
    isPending,
    proposal,
    result,
    errorKey,
    reviewable: reviewableOf(proposal),
    canStartReview: canReview && proposal === null,
    handleReview,
    handleApplied,
  };
}
