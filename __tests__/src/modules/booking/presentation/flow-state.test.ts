import { describe, expect, it } from 'vitest';

import {
  findService,
  flowReducer,
  initialState,
  needsServiceStep,
  stepsFor,
} from '@modules/booking/presentation/components/flow/flow-state';
import type {
  FlowAction,
  FlowConfig,
  FlowState,
} from '@modules/booking/presentation/components/flow/flow-state';

import { ANNEX, BERLIN, COURSE, booking, hold, service, slot } from './fixtures';

const PASSPORT = service();
const MANY: FlowConfig = { services: [PASSPORT, COURSE], fixedServiceId: null };
const SINGLE: FlowConfig = { services: [PASSPORT], fixedServiceId: null };

function run(config: FlowConfig, ...actions: FlowAction[]): FlowState {
  return actions.reduce(
    (state, action) => flowReducer(config, state, action),
    initialState(config),
  );
}

describe('the steps that apply', () => {
  it('asks for the service only when there is a choice', () => {
    expect(needsServiceStep(MANY)).toBe(true);
    expect(needsServiceStep(SINGLE)).toBe(false);
    expect(needsServiceStep({ services: [PASSPORT, COURSE], fixedServiceId: PASSPORT.id })).toBe(
      false,
    );
  });

  it('skips the location and group size steps for a simple service', () => {
    expect(stepsFor(SINGLE, PASSPORT)).toEqual(['time', 'details', 'review', 'done']);
  });

  it('includes the location and group size steps when they are real choices', () => {
    expect(stepsFor(MANY, COURSE)).toEqual([
      'service',
      'location',
      'participants',
      'time',
      'details',
      'review',
      'done',
    ]);
  });

  it('lists every optional step until a service is chosen', () => {
    expect(stepsFor(MANY, null)).toEqual([
      'service',
      'location',
      'participants',
      'time',
      'details',
      'review',
      'done',
    ]);
  });
});

describe('where the flow starts', () => {
  it('starts at the service step when there is a choice', () => {
    const state = initialState(MANY);
    expect(state.step).toBe('service');
    expect(state.serviceId).toBeNull();
  });

  it('never asks a question with one answer', () => {
    const state = initialState(SINGLE);
    expect(state.step).toBe('time');
    expect(state.serviceId).toBe(PASSPORT.id);
    expect(state.locationId).toBe(BERLIN.id);
    expect(state.timeZone).toBe('Europe/Berlin');
  });

  it('honours a service the editor pinned', () => {
    const state = initialState({ services: [PASSPORT, COURSE], fixedServiceId: COURSE.id });
    expect(state.serviceId).toBe(COURSE.id);
    expect(state.step).toBe('location');
  });

  it('starts at the service step when the pinned service no longer exists', () => {
    const state = initialState({ services: [PASSPORT, COURSE], fixedServiceId: 'gone' });
    expect(state.step).toBe('service');
    expect(findService({ services: [PASSPORT], fixedServiceId: 'gone' }, 'gone')).toBeNull();
  });
});

describe('moving through the flow', () => {
  it('goes service -> location -> participants -> time', () => {
    const afterService = run(MANY, { type: 'select-service', serviceId: COURSE.id });
    expect(afterService.step).toBe('location');

    const afterLocation = flowReducer(MANY, afterService, {
      type: 'select-location',
      locationId: ANNEX.id,
    });
    expect(afterLocation.step).toBe('participants');
    expect(afterLocation.locationId).toBe(ANNEX.id);
    expect(afterLocation.timeZone).toBe(ANNEX.timeZone);
  });

  it('ignores a location the service does not offer', () => {
    const state = run(
      MANY,
      { type: 'select-service', serviceId: COURSE.id },
      { type: 'select-location', locationId: 'elsewhere' },
    );
    expect(state.locationId).toBeNull();
    expect(state.step).toBe('location');
  });

  it('ignores a service that is not in the catalog', () => {
    const before = initialState(MANY);
    expect(flowReducer(MANY, before, { type: 'select-service', serviceId: 'nope' })).toBe(before);
  });

  it('keeps the group size within what one booking may hold', () => {
    const base = run(MANY, { type: 'select-service', serviceId: COURSE.id });
    const set = (participants: number) =>
      flowReducer(MANY, base, { type: 'set-participants', participants }).participants;
    expect(set(3)).toBe(3);
    expect(set(99)).toBe(4);
    expect(set(0)).toBe(1);
    expect(set(2.9)).toBe(2);
  });
});

describe('the chosen time and its hold', () => {
  const chosen = slot('2026-10-12', '10:00');

  it('remembers the slot but holds nothing until the server agrees', () => {
    const state = run(SINGLE, { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' });
    expect(state.slot).toEqual(chosen);
    expect(state.hold).toBeNull();
    expect(state.step).toBe('time');
  });

  it('moves to the details once a hold is acquired', () => {
    const state = run(
      SINGLE,
      { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' },
      { type: 'hold-acquired', hold: hold() },
    );
    expect(state.step).toBe('details');
    expect(state.hold?.holdId).toBe('hold-1');
  });

  it('returns to the time step with nothing selected when the hold is lost', () => {
    const state = run(
      SINGLE,
      { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' },
      { type: 'hold-acquired', hold: hold() },
      { type: 'hold-lost' },
    );
    expect(state.step).toBe('time');
    expect(state.slot).toBeNull();
    expect(state.hold).toBeNull();
  });

  it('drops the slot and hold when the group size changes, since availability depends on it', () => {
    const state = run(
      MANY,
      { type: 'select-service', serviceId: COURSE.id },
      { type: 'select-location', locationId: BERLIN.id },
      { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' },
      { type: 'hold-acquired', hold: hold() },
      { type: 'set-participants', participants: 2 },
    );
    expect(state.slot).toBeNull();
    expect(state.hold).toBeNull();
  });

  it('drops the slot when another location is chosen', () => {
    const state = run(
      MANY,
      { type: 'select-service', serviceId: COURSE.id },
      { type: 'select-location', locationId: BERLIN.id },
      { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' },
      { type: 'select-location', locationId: ANNEX.id },
    );
    expect(state.slot).toBeNull();
  });

  it('clears only the hold on request', () => {
    const state = run(
      SINGLE,
      { type: 'choose-slot', slot: chosen, timeZone: 'Europe/Berlin' },
      { type: 'hold-acquired', hold: hold() },
      { type: 'clear-hold' },
    );
    expect(state.hold).toBeNull();
    expect(state.slot).toEqual(chosen);
  });
});

describe('details and the end of the flow', () => {
  it('records typed values per field', () => {
    const state = run(
      SINGLE,
      { type: 'set-value', field: 'firstName', value: 'Ada' },
      { type: 'set-value', field: 'email', value: 'ada@example.org' },
    );
    expect(state.values).toEqual({ firstName: 'Ada', email: 'ada@example.org' });
  });

  it('ends on the confirmation with the hold spent', () => {
    const state = run(
      SINGLE,
      { type: 'hold-acquired', hold: hold() },
      { type: 'confirmed', booking: booking() },
    );
    expect(state.step).toBe('done');
    expect(state.booking?.reference).toBe('BK-ABCD-2345');
    expect(state.hold).toBeNull();
  });

  it('starts over from the beginning, forgetting everything typed', () => {
    const state = run(
      MANY,
      { type: 'select-service', serviceId: COURSE.id },
      { type: 'set-value', field: 'firstName', value: 'Ada' },
      { type: 'restart' },
    );
    expect(state).toEqual(initialState(MANY));
  });

  it('can go back to an earlier step', () => {
    const state = run(
      MANY,
      { type: 'select-service', serviceId: COURSE.id },
      { type: 'go-to', step: 'service' },
    );
    expect(state.step).toBe('service');
    expect(state.serviceId).toBe(COURSE.id);
  });
});
