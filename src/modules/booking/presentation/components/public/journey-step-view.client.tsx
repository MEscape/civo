'use client';

import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { dayAfter, monthOf } from '../../forms/month-calendar';

import { ChoiceList } from './choice-list';
import { ConfirmationPanel } from './confirmation-panel';
import { DayTimes } from './day-times.client';
import { DetailsForm } from './details-form.client';
import { MonthCalendar } from './month-calendar.client';
import { ReviewStep } from './review-step.client';

import type { BookingCatalogDto } from '../../dto/catalog-dto';
import type { JourneyStep } from '../../forms/journey-state';
import type { BookingJourney } from '../../hooks/use-booking-journey';

export interface JourneyStepViewProps {
  readonly catalog: BookingCatalogDto;
  readonly journey: BookingJourney;
}

/**
 * The body of the step the visitor is on; every choice goes back to the journey. A step whose
 * earlier choice is missing draws nothing (the journey never gets there without it).
 */
export function JourneyStepView({ catalog, journey }: JourneyStepViewProps) {
  const t = useTranslations('booking');
  const { state, service, location, isPending } = journey;

  const views: Readonly<Record<JourneyStep, () => ReactNode>> = {
    service: () => (
      <ChoiceList
        chosenId={state.serviceId}
        disabled={isPending}
        onChoose={journey.chooseService}
        choices={catalog.services.map((candidate) => ({
          id: candidate.id,
          title: candidate.name,
          lines: [
            t('public.duration', { minutes: candidate.durationMinutes }),
            ...(candidate.description === null ? [] : [candidate.description]),
          ],
        }))}
      />
    ),
    location: () => (
      <ChoiceList
        chosenId={state.locationId}
        disabled={isPending}
        onChoose={journey.chooseLocation}
        choices={catalog.locations
          .filter((candidate) => service?.locationIds.includes(candidate.id) === true)
          .map((candidate) => ({
            id: candidate.id,
            title: candidate.name,
            lines: candidate.address === null ? [] : [candidate.address],
          }))}
      />
    ),
    date: () =>
      location !== null &&
      service !== null && (
        <MonthCalendar
          month={state.month ?? monthOf(location.today)}
          today={location.today}
          lastDay={dayAfter(location.today, service.horizonDays)}
          freeDays={state.days}
          chosenDay={state.day}
          disabled={isPending}
          onChoose={journey.chooseDay}
          onMonth={journey.showMonth}
        />
      ),
    time: () =>
      location !== null &&
      state.day !== null && (
        <DayTimes
          day={state.day}
          timeZone={location.timeZone}
          times={state.times}
          chosenStart={state.hold?.start ?? null}
          disabled={isPending}
          onChoose={journey.chooseTime}
        />
      ),
    details: () =>
      service !== null && (
        <DetailsForm service={service} details={state.details} onDone={journey.submitDetails} />
      ),
    review: () =>
      state.hold !== null &&
      service !== null && (
        <ReviewStep
          hold={state.hold}
          service={service}
          details={state.details}
          isPending={isPending}
          onConfirm={journey.confirm}
        />
      ),
    done: () => state.booking !== null && <ConfirmationPanel booking={state.booking} />,
  };

  return views[state.step]();
}
