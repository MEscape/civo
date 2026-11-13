'use client';

import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import type { PointMapTiles } from '@components/shared/point-map';
import { Wizard, WizardActions } from '@components/shared/wizard';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useLocationScreen } from '../../hooks/use-location-screen';
import { FormStatus } from '../shared/form-status.client';
import { StaleNotice } from '../shared/stale-notice.client';

import { LocationFormFields } from './location-form-fields.client';
import { LocationImpactDialog } from './location-impact-dialog.client';

import type { LocationDto } from '../../dto/location-dto';
import type { AdoptableServiceDto } from '../../dto/service-dto';
import type { WizardStepKey } from '../../forms/wizard-steps';

export interface LocationFormProps {
  readonly websiteId: string;
  /** A new location, or the one being changed. */
  readonly location: LocationDto | null;
  /** One part on its own, or every step in turn. */
  readonly section: WizardStepKey | 'wizard';
  /** The wizard's current step; the page reads it from the address. */
  readonly step: WizardStepKey;
  /** The zones to choose from, read on the server. */
  readonly timeZones: readonly string[];
  /** The years holidays can be imported for. */
  readonly years: readonly number[];
  readonly listOrigin?: string | undefined;
  /** The map provider's settings, or `null`: the form then has no map and no address suggestions. */
  readonly tiles: PointMapTiles | null;
  /** The services of other locations a new location could take over: a step of its own when there are any. */
  readonly offered?: readonly AdoptableServiceDto[];
}

/**
 * Creating a location (a wizard: basics, hours, exceptions, review) or changing one (the same wizard
 * for "all steps", or one part on its own). Every field is one react-hook-form value, checked by the
 * rules the server applies; the server stays the boundary. The form, the steps and the submission
 * live in `useLocationScreen`; this puts them on the screen.
 */
export function LocationForm({
  websiteId,
  location,
  section,
  step,
  timeZones,
  years,
  listOrigin,
  tiles,
  offered = [],
}: LocationFormProps) {
  const t = useTranslations('booking');
  const screen = useLocationScreen({
    websiteId,
    location,
    section,
    step,
    offered,
    listOrigin,
  });
  const { wizard, submission } = screen;

  const fields = (
    <LocationFormFields
      form={screen.form}
      location={location}
      part={section === 'wizard' ? screen.step : section}
      offered={screen.offerable}
      offer={screen.offer}
      timeZones={timeZones}
      years={years}
      tiles={tiles}
      isPending={submission.isPending}
      translateErrors={screen.translateErrors}
      onEditStep={wizard.goTo}
    />
  );
  const status = (
    <FormStatus
      id="location-form-error"
      isDirty={screen.form.formState.isDirty}
      formCode={submission.formCode}
    />
  );

  return (
    <form
      noValidate
      aria-busy={submission.isPending}
      onSubmit={screen.onSubmit}
      className="space-y-6"
    >
      {submission.isStale && (
        <StaleNotice
          title={t('form.stale.title')}
          body={t('form.stale.body')}
          reloadLabel={t('form.stale.reload')}
        />
      )}
      {section === 'wizard' ? (
        <Wizard
          steps={screen.steps.map((key) => ({ key, label: t(`form.steps.${key}`) }))}
          currentKey={screen.step}
          status={status}
          actions={
            <WizardActions
              cancelHref={screen.cancelHref}
              hasPrevious={wizard.previous !== undefined}
              nextLabel={screen.nextLabel}
              saveLabel={screen.saveLabel}
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
        <DataPanel title={t(`form.steps.${section}`)}>
          <DataPanelBody>{fields}</DataPanelBody>
          <DataPanelFooter status={status}>
            <Link href={screen.cancelHref} className={buttonVariants({ variant: 'outline' })}>
              {t('form.actions.cancel')}
            </Link>
            <Button type="submit" disabled={submission.isPending}>
              {screen.saveLabel}
            </Button>
          </DataPanelFooter>
        </DataPanel>
      )}

      <LocationImpactDialog
        impact={submission.impact}
        initial={screen.initial}
        isPending={submission.isPending}
        onConfirm={submission.confirmImpact}
        onCancel={submission.dismissImpact}
      />
    </form>
  );
}
