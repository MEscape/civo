'use client';

import { ServiceGeneralFields } from './service-general-fields.client';
import { ServiceResourcesFields } from './service-resources-fields.client';
import { ServiceReview } from './service-review.client';
import { ServiceRulesFields } from './service-rules-fields.client';
import { ServiceTimingFields } from './service-timing-fields.client';

import type { ServiceFormOptionsDto } from '../../dto/service-dto';
import type { ServiceStepKey } from '../../forms/service-steps';
import type { ServiceFormValues } from '../../schemas/service-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ServiceFormFieldsProps {
  readonly form: UseFormReturn<ServiceFormValues>;
  readonly options: ServiceFormOptionsDto;
  /** The part to show: one on its own, or the wizard's current step. */
  readonly part: ServiceStepKey;
  readonly isExisting: boolean;
  /** Where a new resource of this location is made. */
  readonly createResourceHref: string;
  readonly errorText: (code: string | undefined) => string | undefined;
  readonly onEditStep: (step: ServiceStepKey) => void;
}

/** The fields of one part of the service form. */
export function ServiceFormFields({
  form,
  options,
  part,
  isExisting,
  createResourceHref,
  errorText,
  onEditStep,
}: ServiceFormFieldsProps) {
  switch (part) {
    case 'general':
      return (
        <ServiceGeneralFields
          form={form}
          categories={options.categories}
          errorText={errorText}
          isExisting={isExisting}
        />
      );
    case 'timing':
      return (
        <ServiceTimingFields form={form} resources={options.resources} errorText={errorText} />
      );
    case 'resources':
      return (
        <ServiceResourcesFields
          form={form}
          resources={options.resources}
          createHref={createResourceHref}
          errorText={errorText}
        />
      );
    case 'rules':
      return (
        <ServiceRulesFields
          form={form}
          qualifications={options.qualifications}
          errorText={errorText}
        />
      );
    case 'review':
      return (
        <ServiceReview
          getValues={form.getValues}
          resources={options.resources}
          onEdit={onEditStep}
          isExisting={isExisting}
        />
      );
  }
}
