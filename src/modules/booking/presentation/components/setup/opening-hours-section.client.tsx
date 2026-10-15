'use client';

import { useState } from 'react';

import { useReportUnsavedChanges } from '@components/shared/unsaved-changes-guard';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { saveLocationAction } from '../../actions/save-location-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { useErrorText } from '../../hooks/use-error-text';
import { useSaveForm } from '../../hooks/use-save-form';
import { locationConfigSchema } from '../../schemas/location-config-schema';
import { AvailabilityEditor } from '../availability/availability-editor';
import { FormErrorSummary } from '../shared/form-error-summary';

import type { LocationDto } from '../../dto/setup-dto';
import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface OpeningHoursSectionProps {
  readonly location: LocationDto;
  readonly canConfigure: boolean;
  /** The week as it is being edited; the workspace keeps it so what is open elsewhere can be checked against it. */
  readonly draft: AvailabilityPlanForm;
  readonly onDraftChange: (next: AvailabilityPlanForm) => void;
  /** The names of services and resources whose own hours reach beyond `draft`. */
  readonly conflicts: readonly string[];
}

const SHOWN_AT_FIELD = ['openingHours'] as const;

/**
 * The week a location is open, drawn as bars to drag. It is the frame for
 * everything else at the place: services and resources can only be open
 * within it. Changes are kept in the page until saved, and saved on their own,
 * without the rest of the location's details.
 */
export function OpeningHoursSection({
  location,
  canConfigure,
  draft,
  onDraftChange,
  conflicts,
}: OpeningHoursSectionProps) {
  const t = useTranslations('booking');
  const saved = planFormOf(location.openingHours);
  const [isSaved, setIsSaved] = useState(false);
  const form = useSaveForm({
    schema: locationConfigSchema,
    save: saveLocationAction,
    onSaved: () => {
      setIsSaved(true);
    },
  });
  const errorText = useErrorText(form.errors);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useReportUnsavedChanges(isDirty);

  return (
    <section aria-labelledby="hours-title" className="space-y-4">
      <div>
        <h2 id="hours-title" className="text-lg font-medium text-copy">
          {t('workspace.hours.title')}
        </h2>
        <p className="text-sm text-copy-muted">{t('workspace.hours.intro')}</p>
      </div>
      <FormErrorSummary errors={form.errors} shownAtField={SHOWN_AT_FIELD} />
      <div className="rounded-token border border-border bg-surface p-4">
        <AvailabilityEditor
          value={draft}
          errors={form.errors}
          errorPath="openingHours"
          disabled={!canConfigure || form.isPending}
          onChange={(next) => {
            setIsSaved(false);
            onDraftChange(next);
          }}
        />
      </div>
      {errorText('openingHours') !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {errorText('openingHours')}
        </p>
      )}
      {conflicts.length > 0 && (
        <div
          role="alert"
          className="rounded-token border border-danger-border bg-danger-subtle p-3 text-sm text-danger"
        >
          <p className="font-medium">{t('workspace.hours.conflictTitle')}</p>
          <p>{t('workspace.hours.conflictHint', { names: conflicts.join(', ') })}</p>
        </div>
      )}
      {canConfigure && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!isDirty || form.isPending || conflicts.length > 0}
            onClick={() => {
              form.submit({
                websiteId: location.websiteId,
                id: location.id,
                name: location.name,
                address: location.address,
                timeZone: location.timeZone,
                openingHours: draft,
                staffHours: location.staffHours,
                isActive: location.isActive,
              });
            }}
          >
            {form.isPending ? t('form.saving') : t('workspace.hours.save')}
          </Button>
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              disabled={form.isPending}
              onClick={() => {
                onDraftChange(saved);
              }}
            >
              {t('workspace.hours.reset')}
            </Button>
          )}
          <p role="status" className="text-sm text-success">
            {isSaved && !isDirty ? t('workspace.hours.saved') : ''}
          </p>
        </div>
      )}
    </section>
  );
}
