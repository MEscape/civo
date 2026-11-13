'use client';

import { Controller } from 'react-hook-form';

import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { Button, buttonVariants } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useTeamMemberForm } from '../../hooks/use-team-member-form';
import { useWeekSummary } from '../../hooks/use-week-summary';
import { ResourceImpactDialog } from '../resources/resource-impact-dialog.client';
import { FormStatus } from '../shared/form-status.client';
import { PeriodsEditor } from '../shared/periods-editor.client';
import { StaleNotice } from '../shared/stale-notice.client';
import { WeeklyHoursEditor } from '../shared/weekly-hours-editor.client';

import { CoverageEditor } from './coverage-editor.client';
import { QualificationsField } from './qualifications-field.client';

import type { DayDto, ExceptionInputDto } from '../../dto/location-dto';
import type { CoverageInputDto, TeamMemberDto } from '../../dto/team-dto';
import type { TeamFormMode } from '../../hooks/use-team-member-submit';

export interface TeamMemberFormProps {
  /** A manager changing an employee's calendar, or the employee their own. */
  readonly mode: TeamFormMode;
  readonly member: TeamMemberDto;
  /** Where to go once saved, and where Cancel goes. */
  readonly savedHref: string;
  readonly cancelHref: string;
  /** The employee's own preferences, named under the hours so the two are not mixed up; only on their own calendar. */
  readonly preferencesHref?: string | undefined;
}

/**
 * An employee's working week (inside the location's hours) and absences, with the editors the
 * locations and resources use; for a manager also the qualifications. A change that takes time away
 * from existing bookings shows them before it is saved.
 */
export function TeamMemberForm(props: TeamMemberFormProps) {
  // The form starts from the calendar it was given and keeps what is typed. When the calendar moved on (the
  // employee or a manager saved) the page is read again with a new version, and the form must start from that:
  // otherwise it would show the old hours under the new version, and saving would silently undo the change.
  return <TeamMemberFields key={props.member.version} {...props} />;
}

function TeamMemberFields({
  mode,
  member,
  savedHref,
  cancelHref,
  preferencesHref,
}: TeamMemberFormProps) {
  const t = useTranslations('booking');
  const summarize = useWeekSummary();
  const { form, submission, translateErrors, onSubmit } = useTeamMemberForm(
    mode,
    member,
    savedHref,
  );
  const { errors } = form.formState;

  return (
    <form noValidate aria-busy={submission.isPending} onSubmit={onSubmit} className="space-y-6">
      {submission.isStale && (
        <StaleNotice
          title={t('team.form.stale.title')}
          body={t('team.form.stale.body')}
          reloadLabel={t('team.form.stale.reload')}
        />
      )}
      {mode === 'manager' && (
        <DataPanel
          title={t('team.qualifications.title')}
          description={t('team.qualifications.hint')}
        >
          <DataPanelBody className="sm:p-4">
            <QualificationsField
              form={form}
              known={member.knownQualifications}
              isPending={submission.isPending}
              translateErrors={translateErrors}
            />
          </DataPanelBody>
        </DataPanel>
      )}

      <DataPanel
        title={t('team.form.hours')}
        description={t('team.form.hoursHint', {
          hours: summarize(member.locationWeekly).join(' · '),
        })}
      >
        <DataPanelBody className="space-y-4 sm:p-4">
          {preferencesHref !== undefined && (
            <p className="text-sm text-copy-muted">
              {t('team.profile.preferencesNote')}{' '}
              <Link
                href={preferencesHref}
                className="font-medium text-primary-copy underline underline-offset-2"
              >
                {t('team.profile.preferencesLink')}
              </Link>
            </p>
          )}
          <Controller
            control={form.control}
            name="openingHours.weekly"
            render={({ field }) => (
              <WeeklyHoursEditor
                value={field.value}
                onChange={(week: DayDto[]) => {
                  field.onChange(week);
                }}
                errors={translateErrors(errors.openingHours?.weekly)}
                disabled={submission.isPending}
                bounds={member.locationWeekly}
              />
            )}
          />
        </DataPanelBody>
      </DataPanel>

      <DataPanel
        title={t('team.absences.title')}
        description={t(
          mode === 'own' ? 'team.absences.descriptionOwn' : 'team.absences.description',
        )}
      >
        <DataPanelBody className="sm:p-4">
          <Controller
            control={form.control}
            name="openingHours.exceptions"
            render={({ field }) => (
              <PeriodsEditor
                words="team.absences"
                value={field.value}
                onChange={(absences: ExceptionInputDto[]) => {
                  field.onChange(absences);
                }}
                errors={translateErrors(errors.openingHours?.exceptions)}
                disabled={submission.isPending}
              />
            )}
          />
        </DataPanelBody>
      </DataPanel>

      {mode === 'manager' && (
        <DataPanel title={t('team.coverage.title')} description={t('team.coverage.description')}>
          <DataPanelBody className="sm:p-4">
            <Controller
              control={form.control}
              name="coverage"
              render={({ field }) => (
                <CoverageEditor
                  value={field.value}
                  onChange={(spells: CoverageInputDto[]) => {
                    field.onChange(spells);
                  }}
                  home={member.location.id}
                  choices={member.coverageChoices}
                  disabled={submission.isPending}
                />
              )}
            />
          </DataPanelBody>
        </DataPanel>
      )}

      <Card className="overflow-hidden">
        <DataPanelFooter
          status={
            <FormStatus
              id="team-form-error"
              isDirty={form.formState.isDirty}
              formCode={submission.formCode}
            />
          }
        >
          <Link href={cancelHref} className={buttonVariants({ variant: 'outline' })}>
            {t('team.form.cancel')}
          </Link>
          <Button type="submit" disabled={submission.isPending}>
            {submission.isPending ? t('team.form.saving') : t('team.form.save')}
          </Button>
        </DataPanelFooter>
      </Card>

      <ResourceImpactDialog
        words="team.impact"
        impact={submission.impact}
        confirmLabel={t('impact.confirm')}
        isPending={submission.isPending}
        onConfirm={submission.confirmImpact}
        onCancel={submission.dismissImpact}
      />
    </form>
  );
}
