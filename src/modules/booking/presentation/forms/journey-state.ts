import type { AvailableSlotsDto, PublicBookingDto } from '../dto/booking-dto';
import type { BookingCatalogDto, CatalogServiceDto } from '../dto/catalog-dto';

export type SlotDto = AvailableSlotsDto['slots'][number];

export const JOURNEY_STEPS = [
  'service',
  'location',
  'date',
  'time',
  'details',
  'review',
  'done',
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

/** Why the visitor is back at the times: somebody took theirs, or their reservation ran out. */
export type JourneyNotice = 'slot-taken' | 'hold-expired';

/** What the visitor typed into the booking form, by field. */
export type JourneyDetails = Readonly<Partial<Record<string, string>>>;

/**
 * Where a visitor is in booking: what they chose, what the server answered (the free days of the
 * month shown, the times of the day chosen, the reservation, the booking) and what they typed. The
 * details outlive a lost time, so nobody types them twice.
 */
export interface JourneyState {
  readonly step: JourneyStep;
  readonly serviceId: string | null;
  readonly locationId: string | null;
  readonly month: string | null;
  /** The free days of `month`; `null` while unknown. */
  readonly days: readonly string[] | null;
  readonly day: string | null;
  /** The free times of `day`; `null` while unknown. */
  readonly times: readonly SlotDto[] | null;
  readonly hold: PublicBookingDto | null;
  readonly details: JourneyDetails;
  readonly booking: PublicBookingDto | null;
  readonly notice: JourneyNotice | null;
}

export type JourneyEvent =
  | {
      readonly type: 'service';
      readonly serviceId: string;
      /** Set when the service is offered at one place only: the place step is skipped. */
      readonly locationId: string | null;
    }
  | { readonly type: 'location'; readonly locationId: string }
  | { readonly type: 'month'; readonly month: string; readonly days: readonly string[] | null }
  | { readonly type: 'day'; readonly day: string }
  | { readonly type: 'times'; readonly times: readonly SlotDto[] }
  | { readonly type: 'held'; readonly hold: PublicBookingDto }
  | { readonly type: 'lost'; readonly notice: JourneyNotice }
  | { readonly type: 'details'; readonly details: JourneyDetails }
  | { readonly type: 'confirmed'; readonly booking: PublicBookingDto }
  | { readonly type: 'go-to'; readonly step: JourneyStep };

/** The steps this visitor walks: a choice with only one answer is made for them and not shown. */
export function stepsOf(catalog: BookingCatalogDto, service: CatalogServiceDto | null) {
  const skipService = catalog.services.length === 1;
  const skipLocation = service !== null && service.locationIds.length === 1;
  return JOURNEY_STEPS.filter(
    (step) => !(step === 'service' && skipService) && !(step === 'location' && skipLocation),
  );
}

/** The step before `step` among `steps`, or `null` at the first. */
export function previousOf(steps: readonly JourneyStep[], step: JourneyStep): JourneyStep | null {
  const index = steps.indexOf(step);
  return index > 0 ? (steps[index - 1] ?? null) : null;
}

function firstStepOf(only: CatalogServiceDto | null, onlyLocation: string | null): JourneyStep {
  if (only === null) {
    return 'service';
  }
  return onlyLocation === null ? 'location' : 'date';
}

export function initialJourney(catalog: BookingCatalogDto): JourneyState {
  const only = catalog.services.length === 1 ? (catalog.services[0] ?? null) : null;
  const onlyLocation = only?.locationIds.length === 1 ? (only.locationIds[0] ?? null) : null;
  return {
    step: firstStepOf(only, onlyLocation),
    serviceId: only?.id ?? null,
    locationId: onlyLocation,
    month: null,
    days: null,
    day: null,
    times: null,
    hold: null,
    details: {},
    booking: null,
    notice: null,
  };
}

const NO_CHOICE = { month: null, days: null, day: null, times: null, hold: null, notice: null };

export function journeyReducer(state: JourneyState, event: JourneyEvent): JourneyState {
  switch (event.type) {
    case 'service':
      return {
        ...state,
        ...NO_CHOICE,
        serviceId: event.serviceId,
        locationId: event.locationId,
        step: event.locationId === null ? 'location' : 'date',
      };
    case 'location':
      return { ...state, ...NO_CHOICE, locationId: event.locationId, step: 'date' };
    case 'month':
      return { ...state, month: event.month, days: event.days };
    case 'day':
      return { ...state, day: event.day, times: null, notice: null, step: 'time' };
    case 'times':
      return { ...state, times: event.times };
    case 'held':
      return { ...state, hold: event.hold, notice: null, step: 'details' };
    case 'lost':
      return { ...state, hold: null, times: null, notice: event.notice, step: 'time' };
    case 'details':
      return { ...state, details: event.details, step: 'review' };
    case 'confirmed':
      return { ...state, booking: event.booking, step: 'done' };
    case 'go-to':
      return { ...state, notice: null, step: event.step };
  }
}
