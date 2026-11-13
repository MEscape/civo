'use client';

import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { Wizard, WizardActions } from '@components/shared/wizard';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { RESOURCE_STEPS } from '../../forms/resource-steps';
import { useResourceScreen } from '../../hooks/use-resource-screen';
import { FormStatus } from '../shared/form-status.client';
import { StaleNotice } from '../shared/stale-notice.client';

import { ResourceAvailabilityFields } from './resource-availability-fields.client';
import { ResourceBasicsFields } from './resource-basics-fields.client';
import { ResourceImpactDialog } from './resource-impact-dialog.client';
import { ResourceReview } from './resource-review.client';

import type { DayDto } from '../../dto/location-dto';
import type { ResourceDto } from '../../dto/resource-dto';
import type { ResourcePartKey, ResourceStepKey } from '../../forms/resource-steps';

export interface ResourceFormProps {
  readonly websiteId: string;
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly weekly: readonly DayDto[];
  };
  /** A new resource, or the one being changed. */
  readonly resource: ResourceDto | null;
  /** One part on its own, or every step in turn. */
  readonly section: ResourcePartKey | 'wizard';
  /** The wizard's current step; the page reads it from the address. */
  readonly step: ResourceStepKey;
  readonly listOrigin?: string | undefined;
}

/**
 * Creating a resource (a wizard: basics, availability, review) or changing one (the same wizard for
 * "all steps", or one part on its own). Every field is one react-hook-form value, checked by the rules
 * the server applies; the server stays the boundary. A change that gives the resource less time or
 * fewer places shows the bookings it reaches before it is saved.
 */
export function ResourceForm({
  websiteId,
  location,
  resource,
  section,
  step,
  listOrigin,
}: ResourceFormProps) {
  const t = useTranslations('booking');
  const screen = useResourceScreen({ websiteId, location, resource, section, step, listOrigin });
  const { form, wizard, submission, isWizard, onSubmit, cancelHref, saveLabel } = screen;

  const fields = {
    basics: (
      <ResourceBasicsFields
        form={form}
        locationName={location.name}
        isKindLocked={resource !== null}
        errorText={screen.errorText}
      />
    ),
    availability: (
      <ResourceAvailabilityFields
        form={form}
        locationWeekly={location.weekly}
        isPending={submission.isPending}
        translateErrors={screen.translateErrors}
      />
    ),
    review: (
      <ResourceReview
        getValues={form.getValues}
        usedBy={resource?.usedBy.length ?? 0}
        onEdit={wizard.goTo}
      />
    ),
  }[screen.part];
  const nextStepLabel = (next: NonNullable<typeof wizard.next>) =>
    wizard.returnsToReview
      ? t('form.actions.toReview')
      : t('resources.form.actions.next', { step: t(`resources.form.steps.${next}`) });
  const nextLabel = wizard.next === undefined ? undefined : nextStepLabel(wizard.next);
  const status = (
    <FormStatus
      id="resource-form-error"
      isDirty={form.formState.isDirty}
      formCode={submission.formCode}
    />
  );

  return (
    <form noValidate aria-busy={submission.isPending} onSubmit={onSubmit} className="space-y-6">
      {submission.isStale && (
        <StaleNotice
          title={t('resources.form.stale.title')}
          body={t('resources.form.stale.body')}
          reloadLabel={t('resources.form.stale.reload')}
        />
      )}
      {isWizard ? (
        <Wizard
          steps={RESOURCE_STEPS.map((key) => ({ key, label: t(`resources.form.steps.${key}`) }))}
          currentKey={step}
          status={status}
          actions={
            <WizardActions
              cancelHref={cancelHref}
              hasPrevious={wizard.previous !== undefined}
              nextLabel={nextLabel}
              saveLabel={saveLabel}
              isPending={submission.isPending}
              onBack={wizard.goBack}
              onNext={() => {
                void wizard.goNext();
              }}
            />
          }
        >
          {fields}
        </Wizard>
      ) : (
        <DataPanel title={t(`resources.form.steps.${screen.part}`)}>
          <DataPanelBody>{fields}</DataPanelBody>
          <DataPanelFooter status={status}>
            <Link href={cancelHref} className={buttonVariants({ variant: 'outline' })}>
              {t('resources.form.actions.cancel')}
            </Link>
            <Button type="submit" disabled={submission.isPending}>
              {saveLabel}
            </Button>
          </DataPanelFooter>
        </DataPanel>
      )}

      <ResourceImpactDialog
        impact={submission.impact?.data ?? null}
        confirmLabel={t('impact.confirm')}
        isPending={submission.isPending}
        onConfirm={submission.confirmImpact}
        onCancel={submission.dismissImpact}
      />
    </form>
  );
}
