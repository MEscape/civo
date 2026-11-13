'use client';

import { Trash2 } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useTeamMembership } from '../../hooks/use-team-membership';

import { MembershipDialogs } from './membership-dialogs.client';

import type { LocationNameDto } from '../../dto/service-dto';
import type { MembershipSubject } from '../../hooks/use-team-membership';

export interface TeamMemberActionsProps {
  readonly subject: MembershipSubject;
  /** The other locations the person can be moved to. */
  readonly moveTargets: readonly LocationNameDto[];
}

/**
 * Where the person belongs, at the heading's far edge like the other pages' actions: move them to the
 * team of another location, or take them out of the team. The same two are in the menu of their row in
 * the team's table, with the same questions and the same review of the bookings that would be open again.
 */
export function TeamMemberActions({ subject, moveTargets }: TeamMemberActionsProps) {
  const t = useTranslations('booking');
  const membership = useTeamMembership(subject);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={moveTargets.length === 0}
        onClick={() => {
          membership.start('move');
        }}
      >
        {t('team.membership.move')}
      </Button>
      <Button
        type="button"
        variant="destructive-ghost"
        onClick={() => {
          membership.start('remove');
        }}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t('team.membership.remove')}
      </Button>
      <MembershipDialogs subject={subject} choices={moveTargets} membership={membership} />
    </>
  );
}
