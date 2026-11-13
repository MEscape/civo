'use client';

import { useId } from 'react';

import { Controller, useWatch } from 'react-hook-form';

import { CheckboxField, FieldMessage } from '@components/shared/field';
import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { CHANGE_ACTORS } from '../../../application/contracts/booking-constraints';
import {
  ANY_EMPLOYEE,
  NO_EMPLOYEE,
  choiceOf,
  fieldsOf,
  qualifiedChoice,
} from '../../forms/employee-choice';
import { LENGTH_CHOICES } from '../../forms/service-length-options';
import { ACTOR_MESSAGE_KEYS } from '../../messages/message-keys';
import { FormSection } from '../shared/form-section';

import { LengthSelectField } from './length-select-field.client';

import type { ServiceFormValues } from '../../schemas/service-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ServiceRulesFieldsProps {
  readonly form: UseFormReturn<ServiceFormValues>;
  /** The qualifications employees hold. */
  readonly qualifications: readonly string[];
  readonly errorText: (code: string | undefined) => string | undefined;
}

/**
 * When a service can be booked, cancelled and changed, by whom, and who serves it. The notice (how
 * long before the appointment booking closes) is asked once, here. Qualification is a requirement:
 * only employees who hold it may take the appointment; their preferences (places, services and hours
 * they like) only decide the order in which open appointments are shown to them.
 */
export function ServiceRulesFields({ form, qualifications, errorText }: ServiceRulesFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const { errors } = form.formState;
  // The select reads two fields, so it follows both.
  const qualification = useWatch({ control: form.control, name: 'qualification' });
  const employee = useWatch({ control: form.control, name: 'employee' });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <FormSection title={t('services.rules.deadlines')}>
        <Controller
          control={form.control}
          name="noticeMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-notice`}
              label={t('services.rules.notice')}
              hint={t('services.rules.noticeHint')}
              value={field.value}
              choices={LENGTH_CHOICES.lead}
              wording="beforeAppointment"
              error={errorText(errors.noticeMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="horizonDays"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-horizon`}
              label={t('services.rules.horizon')}
              hint={t('services.rules.horizonHint')}
              value={field.value}
              choices={LENGTH_CHOICES.horizonDays}
              counts="days"
              error={errorText(errors.horizonDays?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="cancelUntilMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-cancel`}
              label={t('services.rules.cancelUntil')}
              hint={t('services.rules.cancelUntilHint')}
              value={field.value}
              choices={LENGTH_CHOICES.lead}
              wording="beforeAppointment"
              error={errorText(errors.cancelUntilMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="changeUntilMinutes"
          render={({ field }) => (
            <LengthSelectField
              id={`${id}-change`}
              label={t('services.rules.changeUntil')}
              hint={t('services.rules.changeUntilHint')}
              value={field.value}
              choices={LENGTH_CHOICES.lead}
              wording="beforeAppointment"
              error={errorText(errors.changeUntilMinutes?.message)}
              onChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <div className="space-y-8">
        <Controller
          control={form.control}
          name="actors"
          render={({ field }) => (
            <FormSection title={t('services.rules.actorsTitle')}>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {CHANGE_ACTORS.map((actor) => (
                  <CheckboxField
                    key={actor}
                    id={`${id}-actor-${actor}`}
                    label={t(ACTOR_MESSAGE_KEYS[actor])}
                    checked={field.value.includes(actor)}
                    onChange={(event) => {
                      field.onChange(
                        event.target.checked
                          ? [...field.value, actor]
                          : field.value.filter((item) => item !== actor),
                      );
                    }}
                  />
                ))}
              </div>
              <FieldMessage id={`${id}-actors-error`} message={errorText(errors.actors?.message)} />
            </FormSection>
          )}
        />

        <FormSection title={t('services.rules.whoTitle')}>
          <Controller
            control={form.control}
            name="employee"
            render={({ field }) => (
              <SelectField
                id={`${id}-qualification`}
                label={t('services.rules.qualification')}
                options={[
                  { value: NO_EMPLOYEE, label: t('services.rules.noEmployee') },
                  { value: ANY_EMPLOYEE, label: t('services.rules.anyEmployee') },
                  ...qualifications.map((skill) => ({
                    value: qualifiedChoice(skill),
                    label: t('services.rules.qualifiedOption', { skill }),
                  })),
                  // A qualification the service already asks for stays choosable even if nobody holds it now.
                  ...(field.value === 'qualified' && !qualifications.includes(qualification)
                    ? [
                        {
                          value: qualifiedChoice(qualification),
                          label: t('services.rules.qualifiedOption', { skill: qualification }),
                        },
                      ]
                    : []),
                ]}
                value={choiceOf({ employee: field.value, qualification })}
                onValueChange={(choice) => {
                  const next = fieldsOf(choice);
                  field.onChange(next.employee);
                  form.setValue('qualification', next.qualification, { shouldDirty: true });
                }}
                errorMessage={errorText(errors.employee?.message ?? errors.qualification?.message)}
              />
            )}
          />
          {qualifications.length === 0 && (
            <p role="status" className="text-xs text-copy-muted">
              {t('services.rules.qualificationEmpty')}
            </p>
          )}
          {employee !== 'none' && (
            // Two words people mix up, each said once and side by side: one decides who may, the other only the order.
            <dl className="space-y-3 rounded-token border border-border bg-canvas p-4 text-sm">
              <div className="space-y-0.5">
                <dt className="font-medium text-copy">{t('services.rules.qualificationTitle')}</dt>
                <dd className="text-copy-muted">{t('services.rules.qualificationHint')}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="font-medium text-copy">{t('services.rules.preferencesTitle')}</dt>
                <dd className="text-copy-muted">{t('services.rules.preferencesNote')}</dd>
              </div>
            </dl>
          )}
        </FormSection>
      </div>
    </div>
  );
}
