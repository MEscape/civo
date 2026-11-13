import type { BookingChoicesDto } from '../dto/booking-choices-dto';

export type BookingServiceChoice = BookingChoicesDto['services'][number];

/**
 * The services the booking component's service control offers: those of the chosen category when
 * one is chosen (a service of another category would never be shown under it), otherwise all, and
 * whether the stored service is no longer among the running ones.
 */
export function bookingServiceChoices(
  choices: BookingChoicesDto,
  request: { readonly category: unknown; readonly stored: string | null },
): { readonly options: readonly BookingServiceChoice[]; readonly isStale: boolean } {
  const category =
    typeof request.category === 'string' && request.category !== '' ? request.category : null;
  const options =
    category === null
      ? choices.services
      : choices.services.filter((service) => service.category === category);
  return {
    options,
    isStale: request.stored !== null && !options.some((service) => service.id === request.stored),
  };
}
