import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { setUpTeamMemberAction } from '../actions/set-up-team-member-action';

import { useBookingWebsite } from './use-booking-website';

/** A manager gives the chosen member their calendar at the location, then opens it to set it up. */
export function useSetUpMember(locationId: string, hrefOf: (employeeId: string) => string) {
  const router = useRouter();
  const websiteId = useBookingWebsite();
  const [isPending, startTransition] = useTransition();
  const [actorId, setActorId] = useState('');
  const [formCode, setFormCode] = useState<string | null>(null);

  const setUp = () => {
    setFormCode(null);
    startTransition(async () => {
      const result = await setUpTeamMemberAction({ websiteId, actorId, locationId });
      if (result.ok) {
        router.push(hrefOf(result.data.id));
        return;
      }
      setFormCode(result.error.code);
    });
  };

  return { isPending, formCode, actorId, setActorId, setUp };
}
