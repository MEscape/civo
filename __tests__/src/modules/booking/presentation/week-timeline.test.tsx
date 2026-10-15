import { useState } from 'react';

import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NO_HOURS } from '@modules/booking/presentation/drafts/availability-plan-form';
import type { AvailabilityPlanForm } from '@modules/booking/presentation/schemas/availability-plan-schema';
import { WeekTimeline } from '@modules/booking/presentation/timeline/week-timeline';

import { renderBooking } from './ui-support';

type Week = AvailabilityPlanForm['weekly'];

const OFFICE = { intervals: [{ start: '09:00', end: '17:00' }], breaks: [] };

function weekWith(monday: Week[number]): Week {
  return [monday, ...Array.from({ length: 6 }, () => NO_HOURS)];
}

function Harness({
  initial,
  bounds = null,
  onWeek,
}: {
  readonly initial: Week;
  readonly bounds?: Week | null;
  readonly onWeek?: (week: Week) => void;
}) {
  const [week, setWeek] = useState(initial);
  return (
    <>
      <WeekTimeline
        weekly={week}
        bounds={bounds}
        onChange={(next) => {
          setWeek(next);
          onWeek?.(next);
        }}
      />
      <output aria-label="monday">{JSON.stringify(week[0])}</output>
    </>
  );
}

const monday = () =>
  JSON.parse(screen.getByLabelText('monday').textContent ?? 'null') as Week[number];

describe('the week timeline', () => {
  it('draws each open stretch as a bar named with its day and times', () => {
    renderBooking(<Harness initial={weekWith(OFFICE)} />);

    expect(screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Monday, start' })).toHaveAttribute(
      'aria-valuetext',
      '09:00',
    );
    expect(screen.getAllByText('Closed. Click to add hours.')).toHaveLength(6);
  });

  it('moves a bar with the arrow keys, by a quarter hour or, with Shift, by an hour', () => {
    renderBooking(<Harness initial={weekWith(OFFICE)} />);
    const bar = screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' });

    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(monday().intervals).toEqual([{ start: '09:15', end: '17:15' }]);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday: 09:15 to 17:15' }), {
      key: 'ArrowLeft',
      shiftKey: true,
    });
    expect(monday().intervals).toEqual([{ start: '08:15', end: '16:15' }]);
  });

  it('changes one edge with the keys on its slider and never makes the bar shorter than half an hour', () => {
    renderBooking(
      <Harness initial={weekWith({ intervals: [{ start: '09:00', end: '09:30' }], breaks: [] })} />,
    );

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Monday, end' }), { key: 'ArrowRight' });
    expect(monday().intervals).toEqual([{ start: '09:00', end: '09:45' }]);

    const end = () => screen.getByRole('slider', { name: 'Monday, end' });
    fireEvent.keyDown(end(), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(end(), { key: 'ArrowLeft', shiftKey: true });
    expect(monday().intervals).toEqual([{ start: '09:00', end: '09:30' }]);
  });

  it('removes a bar with Delete or its button, taking its breaks along', () => {
    renderBooking(
      <Harness initial={weekWith({ ...OFFICE, breaks: [{ start: '12:00', end: '12:30' }] })} />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' }), {
      key: 'Delete',
    });

    expect(monday()).toEqual({ intervals: [], breaks: [] });
  });

  it('trims a break that no longer fits when the hours are shortened', () => {
    renderBooking(
      <Harness initial={weekWith({ ...OFFICE, breaks: [{ start: '16:00', end: '16:45' }] })} />,
    );

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Monday, end' }), {
      key: 'ArrowLeft',
      shiftKey: true,
    });

    expect(monday().intervals).toEqual([{ start: '09:00', end: '16:00' }]);
    expect(monday().breaks).toEqual([]);
  });

  it('keeps a bar inside the hours it is bounded by, however far it is pushed', () => {
    renderBooking(
      <Harness
        initial={weekWith({ intervals: [{ start: '09:00', end: '12:00' }], breaks: [] })}
        bounds={weekWith({ intervals: [{ start: '08:00', end: '13:00' }], breaks: [] })}
      />,
    );
    const bar = () => screen.getByRole('button', { name: /^Monday: / });

    for (let step = 0; step < 6; step += 1) {
      fireEvent.keyDown(bar(), { key: 'ArrowRight', shiftKey: true });
    }

    expect(monday().intervals).toEqual([{ start: '10:00', end: '13:00' }]);
  });

  it('offers no templates when it is bounded: they would ignore the hours it must stay inside', () => {
    renderBooking(<Harness initial={weekWith(OFFICE)} bounds={weekWith(OFFICE)} />);

    expect(screen.queryByRole('button', { name: 'Office hours' })).toBeNull();
  });

  it('starts from a template and copies Monday to the working days', () => {
    renderBooking(<Harness initial={weekWith(NO_HOURS)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mornings only' }));
    expect(monday().intervals).toEqual([{ start: '08:00', end: '12:00' }]);
    expect(screen.getByRole('button', { name: 'Friday: 08:00 to 12:00' })).toBeInTheDocument();
  });
});

describe('dragging on the week timeline', () => {
  const WIDTH = 720;

  function mockLane() {
    // The shown hours are 07:00 to 19:00, so one pixel is one minute.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: WIDTH,
      width: WIDTH,
      top: 0,
      bottom: 32,
      height: 32,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    Element.prototype.releasePointerCapture = vi.fn();
  }

  function laneOf(bar: HTMLElement): HTMLElement {
    const lane = bar.parentElement?.parentElement;
    if (!lane) {
      throw new Error('the bar is not in a lane');
    }
    return lane;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves a bar with the pointer, in quarter hours', () => {
    mockLane();
    renderBooking(<Harness initial={weekWith(OFFICE)} />);
    const bar = screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' });
    const lane = laneOf(bar);

    fireEvent.pointerDown(bar, { clientX: 300, button: 0, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 367, pointerId: 1 });
    fireEvent.pointerUp(lane, { clientX: 367, pointerId: 1 });

    expect(monday().intervals).toEqual([{ start: '10:00', end: '18:00' }]);
  });

  it('keeps following the pointer when it has left the bar, and stops for good once it is released', () => {
    mockLane();
    renderBooking(<Harness initial={weekWith(OFFICE)} />);
    const lane = laneOf(screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' }));

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' }), {
      clientX: 300,
      button: 0,
      pointerId: 1,
    });
    // The bar is a different stretch now, as it is under a real drag.
    fireEvent.pointerMove(lane, { clientX: 330, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 360, pointerId: 1 });
    expect(monday().intervals).toEqual([{ start: '10:00', end: '18:00' }]);

    fireEvent.lostPointerCapture(lane, { pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 100, pointerId: 1 });

    expect(monday().intervals).toEqual([{ start: '10:00', end: '18:00' }]);
  });

  it('keeps the scale of the week while a bar is held, so it stays under the pointer', () => {
    mockLane();
    renderBooking(<Harness initial={weekWith(OFFICE)} />);
    const lane = laneOf(screen.getByRole('button', { name: 'Monday: 09:00 to 17:00' }));

    fireEvent.pointerDown(screen.getByRole('slider', { name: 'Monday, end' }), {
      clientX: 600,
      button: 0,
      pointerId: 1,
    });
    // 19:00 is the right edge of the lane: the week must not stretch around the longer bar.
    fireEvent.pointerMove(lane, { clientX: 720, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 900, pointerId: 1 });

    expect(monday().intervals).toEqual([{ start: '09:00', end: '19:00' }]);
  });
});
