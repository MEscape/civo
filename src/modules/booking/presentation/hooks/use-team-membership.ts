import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import type { SerializedActionError } from '@lib/result';

import { moveTeamMemberAction } from '../actions/move-team-member-action';
import { previewTeamMemberRemovalAction } from '../actions/preview-team-member-removal-action';
import { removeTeamMemberAction } from '../actions/remove-team-member-action';
import { bookingRoutes } from '../routes';

import type { ResourceImpactDto } from '../dto/resource-dto';

/** Whose membership it is: what the use cases need to name, which a row of the team and a calendar's page both have. */
export interface MembershipSubject {
  readonly websiteId: string;
  readonly id: string;
  readonly name: string;
  /** The version the calendar was read at. */
  readonly version: string;
  /** The location of the team they are in. */
  readonly locationId: string;
}

/** What the manager is about to do to the membership: take the person out of the team, or to another team. */
export type MembershipAction = 'remove' | 'move';

/**
 * Taking a member out of their team, or moving them to another. Both ask which bookings that makes open
 * again before anything is saved, and are saved only after they have been seen. Success is shown by
 * arriving where the person is now: the team they left, or their calendar in the new one.
 */
export function useTeamMembership(member: MembershipSubject) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<MembershipAction | null>(null);
  const [locationId, setLocationId] = useState('');
  const [impact, setImpact] = useState<ResourceImpactDto | null>(null);
  const [failure, setFailure] = useState<SerializedActionError | null>(null);

  const request = (acknowledgeImpact: boolean) => ({
    websiteId: member.websiteId,
    employeeId: member.id,
    expectedVersion: member.version,
    acknowledgeImpact,
  });

  const close = () => {
    setAction(null);
    setImpact(null);
    setFailure(null);
    setLocationId('');
  };

  function commit(acknowledgeImpact: boolean) {
    startTransition(async () => {
      if (action === 'move') {
        const moved = await moveTeamMemberAction({ ...request(acknowledgeImpact), locationId });
        if (moved.ok) {
          router.push(bookingRoutes.teamMember(member.websiteId, locationId, moved.data.id));
          return;
        }
        setImpact(null);
        setFailure(moved.error);
        return;
      }
      const removed = await removeTeamMemberAction(request(acknowledgeImpact));
      if (removed.ok) {
        router.push(bookingRoutes.locationTeam(member.websiteId, member.locationId));
        return;
      }
      setImpact(null);
      setFailure(removed.error);
    });
  }

  /** Looks at what it would reach first: a booking that would be left open is shown before it is. */
  function confirm() {
    setFailure(null);
    startTransition(async () => {
      const found = await previewTeamMemberRemovalAction({
        websiteId: member.websiteId,
        employeeId: member.id,
      });
      if (!found.ok) {
        setFailure(found.error);
        return;
      }
      if (found.data.affected.length > 0 || found.data.isTruncated) {
        setImpact(found.data);
        return;
      }
      commit(false);
    });
  }

  return {
    action,
    locationId,
    impact,
    failure,
    isPending,
    isConfirmDisabled: action === 'move' && locationId === '',
    start: (next: MembershipAction) => {
      setAction(next);
    },
    chooseLocation: setLocationId,
    confirm,
    confirmImpact: () => {
      commit(true);
    },
    dismissImpact: () => {
      setImpact(null);
    },
    close,
  };
}
