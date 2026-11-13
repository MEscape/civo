'use client';

import { Controller } from 'react-hook-form';

import type { PointMapTiles } from '@components/shared/point-map';

import { WeeklyHoursEditor } from '../shared/weekly-hours-editor.client';

import { ExceptionsEditor } from './exceptions-editor.client';
import { LocationBasicsFields } from './location-basics-fields.client';
import { LocationReview } from './location-review.client';
import { LocationServicesFields } from './location-services-fields.client';

import type { DayDto, ExceptionInputDto, LocationDto } from '../../dto/location-dto';
import type { AdoptableServiceDto } from '../../dto/service-dto';
import type { WizardStepKey } from '../../forms/wizard-steps';
import type { Offer } from '../../hooks/use-location-offer';
import type { LocationFormValues } from '../../schemas/location-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface LocationFormFieldsProps {
  readonly form: UseFormReturn<LocationFormValues>;
  readonly location: LocationDto | null;
  /** The part to show: one on its own, or `wizard`, where the step says which. */
  readonly part: WizardStepKey;
  readonly timeZones: readonly string[];
  readonly years: readonly number[];
  readonly tiles: PointMapTiles | null;
  readonly isPending: boolean;
  /** The messages under a part of the form's errors, by path inside it, already translated. */
  readonly translateErrors: (subtree: unknown) => Record<string, string>;
  readonly onEditStep: (step: WizardStepKey) => void;
  /** The services a new location could take over, and which of them it does. */
  readonly offered: readonly AdoptableServiceDto[];
  readonly offer: Offer;
}

/** The fields of one part of the location form. */
export function LocationFormFields({
  form,
  location,
  part,
  timeZones,
  years,
  tiles,
  isPending,
  translateErrors,
  onEditStep,
  offered,
  offer,
}: LocationFormFieldsProps) {
  const { errors } = form.formState;

  switch (part) {
    case 'basics':
      return (
        <LocationBasicsFields
          form={form}
          timeZones={timeZones}
          isZoneLocked={(location?.futureBookingCount ?? 0) > 0}
          tiles={tiles}
        />
      );
    case 'hours':
      return (
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
              disabled={isPending}
            />
          )}
        />
      );
    case 'exceptions':
      return (
        <Controller
          control={form.control}
          name="openingHours.exceptions"
          render={({ field }) => (
            <ExceptionsEditor
              value={field.value}
              onChange={(next: ExceptionInputDto[]) => {
                field.onChange(next);
              }}
              errors={translateErrors(errors.openingHours?.exceptions)}
              years={years}
            />
          )}
        />
      );
    case 'services':
      return <LocationServicesFields services={offered} offer={offer} isPending={isPending} />;
    case 'review':
      return (
        <LocationReview
          getValues={form.getValues}
          onEdit={onEditStep}
          offeredCount={offered.length > 0 ? offer.count : null}
        />
      );
  }
}
