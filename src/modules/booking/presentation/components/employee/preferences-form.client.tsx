'use client';

import { DataPanel, DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { usePreferencesForm } from '../../hooks/use-preferences-form';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { FormStatus } from '../shared/form-status.client';

import { PreferencesWindowPanel } from './preferences-window-panel.client';
import { ServiceChooser } from './service-chooser.client';

import type { PreferencesDto } from '../../dto/employee-dto';

export interface PreferencesFormProps {
  readonly view: PreferencesDto;
}

/**
 * Mockup 04: what and when the employee would like to work, as two panels like every other form of
 * the module, saved together from one footer. It only orders what they are offered (BD-07),
 * which the page says above the form; the working hours that decide when they can be booked are the
 * calendar's, and the time window says so.
 */
export function PreferencesForm({ view }: PreferencesFormProps) {
  const t = useTranslations('booking');
  const prefs = usePreferencesForm(view);
  const { errors, isDirty } = prefs.form.formState;
  const textOf = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  const { window } = prefs.values;

  return (
    <form onSubmit={prefs.submit} aria-busy={prefs.isPending} noValidate className="space-y-6">
      {/* What they like to do beside when: the services are the long list, so they get the wider column. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DataPanel
          title={t('employee.preferences.services.title')}
          description={t('employee.preferences.services.description')}
        >
          <DataPanelBody className="space-y-4 sm:p-4">
            <ServiceChooser
              services={view.services}
              chosen={prefs.values.serviceIds}
              disabled={prefs.isPending}
              onToggle={prefs.toggleService}
            />
            <FieldMessage id="pref-services-error" message={textOf(errors.serviceIds?.message)} />
          </DataPanelBody>
        </DataPanel>

        <PreferencesWindowPanel
          window={window}
          startError={textOf(errors.window?.startMinute?.message)}
          endError={textOf(errors.window?.endMinute?.message ?? errors.window?.message)}
          disabled={prefs.isPending}
          onChange={prefs.setWindow}
          onAdd={prefs.addWindow}
        />
      </div>

      <Card className="overflow-hidden">
        <DataPanelFooter
          status={
            prefs.isSaved ? (
              <p className="text-success">{t('employee.preferences.saved')}</p>
            ) : (
              <FormStatus
                id="preferences-form-error"
                isDirty={isDirty}
                formCode={prefs.formError}
              />
            )
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={prefs.isPending || !isDirty}
            onClick={prefs.reset}
          >
            {t('employee.preferences.reset')}
          </Button>
          <Button type="submit" disabled={prefs.isPending || !isDirty}>
            {t('employee.preferences.save')}
          </Button>
        </DataPanelFooter>
      </Card>
    </form>
  );
}
