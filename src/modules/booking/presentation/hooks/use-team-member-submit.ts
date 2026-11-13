import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';
import type { SerializedActionError } from '@lib/result';

import { BOOKING_ERROR_CODES as ERRORS } from '../../application/contracts/booking-constraints';
import { previewOwnProfileChangeAction } from '../actions/preview-own-profile-change-action';
import { previewTeamMemberChangeAction } from '../actions/preview-team-member-change-action';
import { saveOwnProfileAction } from '../actions/save-own-profile-action';
import { updateTeamMemberAction } from '../actions/update-team-member-action';
import { changesTime } from '../forms/team-form-values';

import type { ResourceImpactDto } from '../dto/resource-dto';
import type { TeamMemberDto } from '../dto/team-dto';
import type { TeamMemberFormValues } from '../schemas/team-schema';
import type { UseFormSetError } from 'react-hook-form';

/** Whose calendar the form changes: a manager's view of an employee, or the employee's own. */
export type TeamFormMode = 'manager' | 'own';

export interface TeamMemberSubmitOptions {
  readonly mode: TeamFormMode;
  readonly member: TeamMemberDto;
  readonly initial: TeamMemberFormValues;
  /** Where to go once saved. */
  readonly savedHref: string;
  readonly setError: UseFormSetError<TeamMemberFormValues>;
}

function save(
  { mode, member }: Pick<TeamMemberSubmitOptions, 'mode' | 'member'>,
  values: TeamMemberFormValues,
  acknowledgeImpact: boolean,
) {
  const common = {
    websiteId: member.websiteId,
    openingHours: values.openingHours,
    expectedVersion: member.version,
    acknowledgeImpact,
  };
  return mode === 'manager'
    ? updateTeamMemberAction({
        ...common,
        employeeId: member.id,
        qualifications: values.qualifications,
        coverage: values.coverage,
      })
    : saveOwnProfileAction(common);
}

function preview(mode: TeamFormMode, member: TeamMemberDto, values: TeamMemberFormValues) {
  const calendar = { openingHours: values.openingHours };
  return mode === 'manager'
    ? previewTeamMemberChangeAction({
        websiteId: member.websiteId,
        employeeId: member.id,
        calendar,
        coverage: values.coverage,
      })
    : previewOwnProfileChangeAction({ websiteId: member.websiteId, calendar });
}

/**
 * Saving a calendar. A change that touches the week or the absences first asks which existing
 * bookings it would leave without the employee, and is saved only after they have been seen.
 * Success is shown by arriving at `savedHref`; a refusal is put on its field, shown as the form's
 * message, or (when somebody else saved first) as a notice that keeps the input.
 */
export function useTeamMemberSubmit({
  mode,
  member,
  initial,
  savedHref,
  setError,
}: TeamMemberSubmitOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formCode, setFormCode] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [impact, setImpact] = useState<{
    values: TeamMemberFormValues;
    data: ResourceImpactDto;
  } | null>(null);

  function failedWith(error: SerializedActionError) {
    if (error.code === ERRORS.resourceStale) {
      setIsStale(true);
      return;
    }
    setFormCode(applyActionError(error, setError));
  }

  function commit(values: TeamMemberFormValues, acknowledgeImpact: boolean) {
    startTransition(async () => {
      const result = await save({ mode, member }, values, acknowledgeImpact);
      setImpact(null);
      if (result.ok) {
        router.push(savedHref);
        return;
      }
      failedWith(result.error);
    });
  }

  function submit(values: TeamMemberFormValues) {
    setFormCode(null);
    setIsStale(false);
    if (!changesTime(values, initial)) {
      commit(values, false);
      return;
    }
    startTransition(async () => {
      const found = await preview(mode, member, values);
      if (!found.ok) {
        failedWith(found.error);
        return;
      }
      if (found.data.affected.length > 0 || found.data.isTruncated) {
        setImpact({ values, data: found.data });
        return;
      }
      commit(values, false);
    });
  }

  return {
    isPending,
    formCode,
    isStale,
    impact: impact?.data ?? null,
    submit,
    confirmImpact: () => {
      if (impact !== null) {
        commit(impact.values, true);
      }
    },
    dismissImpact: () => {
      setImpact(null);
    },
  };
}
