'use client';

import { useState } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { setStaffHoursAction } from '../../actions/set-staff-hours-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { daysOutside } from '../../drafts/hours-conflicts';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { staffHoursSchema } from '../../schemas/staff-hours-schema';
import { WeekTimeline } from '../../timeline/week-timeline';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { TeamDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface StaffHoursPolicyProps {
  readonly websiteId: string;
  readonly location: TeamDto['locations'][number];
  readonly members: TeamDto['members'];
}

const SHOWN_AT_FIELD = ['staffHours'] as const;

/**
 * When employees may work at one location: whenever it is open, or inside a
 * narrower week set here. It is the frame every employee's own hours stay in.
 * Before it is saved the employees whose week would be cut to fit are named,
 * and after, each of them is told on their own calendar that a manager changed
 * it: nobody's hours change without them being able to see that they did.
 */
export function StaffHoursPolicy({ websiteId, location, members }: StaffHoursPolicyProps) {
  const t = useTranslations('booking');
  const opening = planFormOf(location.openingHours);
  const saved = location.staffHours === null ? null : planFormOf(location.staffHours);
  const [isLimited, setIsLimited] = useState(saved !== null);
  const [draft, setDraft] = useState<AvailabilityPlanForm>(saved ?? opening);
  const [isSaved, setIsSaved] = useState(false);
  const form = useSaveForm({
    schema: staffHoursSchema,
    save: setStaffHoursAction,
    onSaved: () => {
      setIsSaved(true);
    },
  });
  const errorText = useErrorText(form.errors);

  const next = isLimited ? draft : null;
  const isDirty = JSON.stringify(next) !== JSON.stringify(saved);
  useReportUnsavedChanges(isDirty);

  // Who would be cut to fit: an employee whose own week, or the opening hours they follow, reaches beyond.
  const affected = members
    .filter((member) => member.locationId === location.id && next !== null)
    .filter(
      (member) =>
        daysOutside(
          member.availability === null ? opening.weekly : planFormOf(member.availability).weekly,
          next?.weekly ?? opening.weekly,
        ).length > 0 ||
        (member.availability === null && !isSameWeek(next, opening)),
    )
    .map((member) => member.name);

  return (
    <details className="group rounded-token border border-border bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-token px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-copy">{location.name}</span>
        <Badge variant={saved === null ? 'outline' : 'info'}>
          {saved === null ? t('team.policy.open') : t('team.policy.limited')}
        </Badge>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        <CheckboxField
          id={`staff-limited-${location.id}`}
          label={t('team.policy.toggle')}
          hint={t('team.policy.toggleHint')}
          checked={isLimited}
          onChange={(event) => {
            setIsSaved(false);
            setIsLimited(event.target.checked);
          }}
        />
        {isLimited && (
          <WeekTimeline
            weekly={draft.weekly}
            bounds={opening.weekly}
            disabled={form.isPending}
            problemOn={(dayIndex) => errorText(`staffHours.weekly.${dayIndex}.intervals`)}
            onChange={(weekly) => {
              setIsSaved(false);
              setDraft({ ...draft, weekly });
            }}
          />
        )}
        <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />
        {affected.length > 0 && (
          <p
            role="status"
            className="rounded-token border border-warning-border bg-warning-subtle p-3 text-sm text-warning"
          >
            {t('team.policy.affected', { names: affected.join(', ') })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!isDirty || form.isPending}
            onClick={() => {
              form.submit({ websiteId, locationId: location.id, staffHours: next });
            }}
          >
            {form.isPending ? t('form.saving') : t('team.policy.save')}
          </Button>
          <p role="status" className="text-sm text-success">
            {isSaved && !isDirty ? t('team.policy.saved') : ''}
          </p>
        </div>
      </div>
    </details>
  );
}

function isSameWeek(a: AvailabilityPlanForm | null, b: AvailabilityPlanForm): boolean {
  return a !== null && JSON.stringify(a.weekly) === JSON.stringify(b.weekly);
}
