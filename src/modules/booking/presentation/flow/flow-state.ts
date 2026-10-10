import type { SlotDto } from '../dto/availability-dto';
import type { BookingDto, HoldDto } from '../dto/booking-dto';
import type { PublicServiceDto } from '../dto/catalog-dto';

/**
 * The steps of the public flow. They adapt to the service: a service offered
 * at one place has no location step, one booked a single person at a time has
 * no group-size step, and a catalog with one service starts past the choice.
 */
export const FLOW_STEPS = [
  'service',
  'location',
  'participants',
  'time',
  'details',
  'review',
  'done',
] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export interface FlowState {
  readonly step: FlowStep;
  readonly serviceId: string | null;
  readonly locationId: string | null;
  readonly participants: number;
  readonly slot: SlotDto | null;
  /** The zone the chosen slot's wall-clock time belongs to. */
  readonly timeZone: string | null;
  readonly hold: HoldDto | null;
  readonly values: Readonly<Record<string, string>>;
  readonly booking: BookingDto | null;
}

export interface FlowConfig {
  /** Services the visitor can choose from. */
  readonly services: readonly PublicServiceDto[];
  /** A service the component is pinned to (editor choice), skipping the service step. */
  readonly fixedServiceId: string | null;
}

export type FlowAction =
  | { readonly type: 'select-service'; readonly serviceId: string }
  | { readonly type: 'select-location'; readonly locationId: string }
  | { readonly type: 'set-participants'; readonly participants: number }
  | { readonly type: 'choose-slot'; readonly slot: SlotDto; readonly timeZone: string }
  | { readonly type: 'hold-acquired'; readonly hold: HoldDto }
  | { readonly type: 'hold-lost' }
  | { readonly type: 'clear-hold' }
  | { readonly type: 'set-value'; readonly field: string; readonly value: string }
  | { readonly type: 'confirmed'; readonly booking: BookingDto }
  | { readonly type: 'go-to'; readonly step: FlowStep }
  | { readonly type: 'restart' };

export function findService(config: FlowConfig, serviceId: string | null): PublicServiceDto | null {
  return config.services.find((service) => service.id === serviceId) ?? null;
}

/** Whether the visitor has to pick the service at all. */
export function needsServiceStep(config: FlowConfig): boolean {
  return config.fixedServiceId === null && config.services.length > 1;
}

/** The steps that apply to this selection, in order. `done` is the end, not a step to go "back" from. */
export function stepsFor(config: FlowConfig, service: PublicServiceDto | null): FlowStep[] {
  const steps: FlowStep[] = [];
  if (needsServiceStep(config)) {
    steps.push('service');
  }
  if (service === null || service.locations.length > 1) {
    steps.push('location');
  }
  if (service === null || service.maxParticipantsPerBooking > 1) {
    steps.push('participants');
  }
  steps.push('time', 'details', 'review', 'done');
  return steps;
}

/** The service the visitor never has to choose: the pinned one, or the only one there is. */
function soleService(config: FlowConfig): PublicServiceDto | null {
  if (config.fixedServiceId !== null) {
    return findService(config, config.fixedServiceId);
  }
  return config.services.length === 1 ? (config.services[0] ?? null) : null;
}

/**
 * Where the flow starts: the service (or the next step after it) when there
 * is a single choice, so a visitor never answers a question with one answer.
 */
export function initialState(config: FlowConfig): FlowState {
  const base: FlowState = {
    step: 'service',
    serviceId: null,
    locationId: null,
    participants: 1,
    slot: null,
    timeZone: null,
    hold: null,
    values: {},
    booking: null,
  };
  const only = soleService(config);
  return only === null ? base : selectService(config, base, only);
}

function firstStepAfterService(config: FlowConfig, service: PublicServiceDto): FlowStep {
  return stepsFor(config, service).find((step) => step !== 'service') ?? 'time';
}

function selectService(config: FlowConfig, state: FlowState, service: PublicServiceDto): FlowState {
  const onlyLocation = service.locations.length === 1 ? (service.locations[0] ?? null) : null;
  return {
    ...state,
    serviceId: service.id,
    locationId: onlyLocation?.id ?? null,
    participants: 1,
    slot: null,
    timeZone: onlyLocation?.timeZone ?? null,
    hold: null,
    step: firstStepAfterService(config, service),
  };
}

/** Everything chosen after the time depends on it, so a different time clears the hold. */
function withoutSlot(state: FlowState): FlowState {
  return { ...state, slot: null, hold: null };
}

function selectServiceById(config: FlowConfig, state: FlowState, serviceId: string): FlowState {
  const chosen = findService(config, serviceId);
  return chosen === null ? state : selectService(config, state, chosen);
}

function selectLocation(config: FlowConfig, state: FlowState, locationId: string): FlowState {
  const service = findService(config, state.serviceId);
  const location = service?.locations.find((candidate) => candidate.id === locationId);
  if (service === null || location === undefined) {
    return state;
  }
  const steps = stepsFor(config, service);
  return {
    ...withoutSlot(state),
    locationId: location.id,
    timeZone: location.timeZone,
    step: steps[steps.indexOf('location') + 1] ?? 'time',
  };
}

function setParticipants(
  state: FlowState,
  service: PublicServiceDto | null,
  requested: number,
): FlowState {
  const max = service?.maxParticipantsPerBooking ?? 1;
  const participants = Math.min(Math.max(1, Math.trunc(requested)), max);
  return { ...withoutSlot(state), participants };
}

export function flowReducer(config: FlowConfig, state: FlowState, action: FlowAction): FlowState {
  const service = findService(config, state.serviceId);
  switch (action.type) {
    case 'select-service':
      return selectServiceById(config, state, action.serviceId);
    case 'select-location':
      return selectLocation(config, state, action.locationId);
    case 'set-participants':
      return setParticipants(state, service, action.participants);
    case 'choose-slot':
      return { ...state, slot: action.slot, timeZone: action.timeZone, hold: null };
    case 'hold-acquired':
      return { ...state, hold: action.hold, step: 'details' };
    case 'hold-lost':
      return { ...withoutSlot(state), step: 'time' };
    case 'clear-hold':
      return { ...state, hold: null };
    case 'set-value':
      return { ...state, values: { ...state.values, [action.field]: action.value } };
    case 'confirmed':
      return { ...state, booking: action.booking, hold: null, step: 'done' };
    case 'go-to':
      return { ...state, step: action.step };
    case 'restart':
      return initialState(config);
  }
}
