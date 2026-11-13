'use client';

import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { Wizard, WizardActions } from '@components/shared/wizard';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useServiceScreen } from '../../hooks/use-service-screen';
import { bookingRoutes } from '../../routes';
import { FormStatus } from '../shared/form-status.client';
import { StaleNotice } from '../shared/stale-notice.client';

import { ServiceFormFields } from './service-form-fields.client';
import { SharedChangeDialog } from './shared-change-dialog.client';

import type { ServiceDto, ServiceFormOptionsDto } from '../../dto/service-dto';
import type { ServiceStepKey } from '../../forms/service-steps';

export interface ServiceFormProps {
  readonly websiteId: string;
  readonly locationId: string;
  /** A new service, or the one being changed. */
  readonly service: ServiceDto | null;
  /** One part on its own, or every step in turn. */
  readonly part: ServiceStepKey | 'wizard';
  /** The wizard's current step; the page reads it from the address. */
  readonly step: ServiceStepKey;
  /** What the form offers to choose from, read on the server from the data. */
  readonly options: ServiceFormOptionsDto;
  readonly listOrigin?: string | undefined;
}

/**
 * Creating a service (a wizard: general, timing, resources, rules, review) or changing one (the
 * same wizard for "all steps", or one part on its own). Every field is one react-hook-form value,
 * checked by the rules the server applies; the server stays the boundary. The form, the steps and
 * the submission live in `useServiceScreen`; this puts them on the screen.
 */
export function ServiceForm({
  websiteId,
  locationId,
  service,
  part,
  step,
  options,
  listOrigin,
}: ServiceFormProps) {
  const t = useTranslations('booking');
  const screen = useServiceScreen({
    websiteId,
    locationId,
    service,
    part,
    hasResources: options.resources.length > 0,
    step,
    listOrigin,
  });
  const { wizard, submission } = screen;

  const fields = (
    <ServiceFormFields
      form={screen.form}
      options={options}
      part={part === 'wizard' ? screen.step : part}
      isExisting={service !== null}
      createResourceHref={bookingRoutes.resourceNew(websiteId, locationId)}
      errorText={screen.errorText}
      onEditStep={wizard.goTo}
    />
  );
  const status = (
    <FormStatus
      id="service-form-error"
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
          title={t('services.stale.title')}
          body={t('services.stale.body')}
          reloadLabel={t('form.stale.reload')}
        />
      )}
      {part === 'wizard' ? (
        <Wizard
          steps={screen.steps.map((key) => ({ key, label: t(`services.steps.${key}`) }))}
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
        <DataPanel title={t(`services.steps.${part}`)}>
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

      <SharedChangeDialog
        pending={submission.pendingShared}
        sharedWith={service?.sharedWith ?? []}
        isPending={submission.isPending}
        onConfirm={submission.confirmShared}
        onCancel={submission.dismissShared}
      />
    </form>
  );
}
