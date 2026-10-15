'use client';

import { useState } from 'react';

import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { setTeamHoursAction } from '../../actions/set-team-hours-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { teamHoursSchema } from '../../schemas/team-hours-schema';
import { AvailabilityEditor } from '../availability/availability-editor';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { TeamMemberDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface TeamMemberHoursProps {
  readonly websiteId: string;
  readonly member: TeamMemberDto;
  /** The week employees may work at this person's location: the frame of their own. */
  readonly frameWeek: AvailabilityPlanForm['weekly'];
  /** Whether a manager has narrowed that week, which changes what "same as the location" means. */
  readonly hasStaffHours: boolean;
  /** Everyone else on the team: "the same hours for everyone" reaches them. */
  readonly colleagueIds: readonly string[];
}

const SHOWN_AT_FIELD = ['availability', 'resourceIds'] as const;

/**
 * The week of one employee, drawn inside the hours employees may work at their
 * location. It can be saved for this person, handed to the whole team in one
 * step, or taken back to the allowed hours.
 */
export function TeamMemberHours({
  websiteId,
  member,
  frameWeek,
  hasStaffHours,
  colleagueIds,
}: TeamMemberHoursProps) {
  const t = useTranslations('booking');
  // Someone who follows the location starts from its week, so narrowing it is one drag away.
  const baseline: AvailabilityPlanForm =
    member.availability === null
      ? { weekly: frameWeek, exceptions: [] }
      : planFormOf(member.availability);
  const [draft, setDraft] = useState<AvailabilityPlanForm>(baseline);
  const form = useSaveForm({
    schema: teamHoursSchema,
    save: setTeamHoursAction,
    onSaved: () => undefined,
  });
  const errorText = useErrorText(form.errors);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useReportUnsavedChanges(isDirty);

  function submit(resourceIds: readonly string[], availability: AvailabilityPlanForm | null) {
    form.submit({ websiteId, resourceIds, availability });
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-copy">{t('team.hoursTitle')}</h3>
      <p className="text-xs text-copy-muted">
        {member.availability === null ? t('team.followsLocationHint') : t('team.ownHoursHint')}
      </p>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />
      <AvailabilityEditor
        value={draft}
        bounds={frameWeek}
        errors={form.errors}
        disabled={form.isPending}
        onChange={setDraft}
      />
      {errorText('availability') !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {errorText('availability')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={form.isPending}
          onClick={() => {
            submit([member.id], draft);
          }}
        >
          {form.isPending ? t('form.saving') : t('team.save')}
        </Button>
        {colleagueIds.length > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={form.isPending}
            onClick={() => {
              submit([member.id, ...colleagueIds], draft);
            }}
          >
            {t('team.applyToAll', { count: colleagueIds.length + 1 })}
          </Button>
        )}
        {(member.availability !== null || hasStaffHours) && (
          <Button
            type="button"
            variant="ghost"
            disabled={form.isPending}
            onClick={() => {
              // With narrowed hours there is no "follow the location": the allowed hours are the plan.
              submit([member.id], hasStaffHours ? { weekly: frameWeek, exceptions: [] } : null);
            }}
          >
            {hasStaffHours ? t('team.followStaffHours') : t('team.followLocation')}
          </Button>
        )}
      </div>
      {isDirty && <p className="text-xs text-copy-muted">{t('team.unsaved')}</p>}
    </section>
  );
}
