'use client';

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { clamp } from '@lib/utils';

import { changeHoursRange, intervalAt, segmentsOf } from '../forms/week/change-range';

import type { DayDto } from '../dto/location-dto';
import type { DragPart, HoursTarget, RangeKind } from '../forms/week/change-range';
import type { HoursRange } from '../forms/week/range';
import type { Minutes } from '../forms/week/time';

interface Gesture {
  readonly day: DayDto;
  readonly kind: RangeKind;
  readonly index: number;
  readonly part: DragPart;
  readonly pointer: number;
  readonly origin: number;
  readonly width: number;
  /** The stretch the bar drew when the gesture began: the axis stays put while a hand is on it. */
  readonly range: HoursRange;
  /** The last step the gesture reported, so a move inside one step changes nothing. */
  readonly lastDelta: number;
}

const STEP_MINUTES = 15;
const LARGE_STEP_MINUTES = 60;

/**
 * The step a drag may take, kept inside what the bar draws: a range cannot be pulled past the axis
 * (which would redraw every bar of the week under the pointer); the exact fields still reach any time.
 */
function withinRange(delta: number, gesture: Gesture): number {
  const { day, range, ...target } = gesture;
  const segment = segmentsOf(day).find(
    ({ kind, index }) => kind === target.kind && index === target.index,
  );
  if (segment === undefined) {
    return delta;
  }
  const low = target.part === 'end' ? -Infinity : range.from - segment.start;
  const high = target.part === 'start' ? Infinity : range.to - segment.end;
  return clamp(delta, low, high);
}

/** Pointer capture keeps a drag active outside the handle; keyboard edits use the same bounded operation. */
export function useHoursDrag({
  day,
  onChange,
  disabled,
  range,
  limits,
}: {
  readonly day: DayDto;
  readonly onChange: ((day: DayDto) => void) | undefined;
  readonly disabled: boolean;
  readonly range: HoursRange;
  /** The stretches the day may be open in; none given, any time. */
  readonly limits?: readonly Minutes[] | undefined;
}) {
  const gesture = useRef<Gesture | null>(null);
  function begin(event: PointerEvent<HTMLElement>, target: HoursTarget) {
    if (disabled || onChange === undefined || event.button !== 0) {
      return;
    }
    const width = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
    if (width <= 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      day,
      ...target,
      pointer: event.pointerId,
      origin: event.clientX,
      width,
      range,
      lastDelta: 0,
    };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (active?.pointer !== event.pointerId || disabled) {
      return;
    }
    const span = active.range.to - active.range.from;
    const delta = withinRange(
      Math.round((((event.clientX - active.origin) / active.width) * span) / STEP_MINUTES) *
        STEP_MINUTES,
      active,
    );
    // Many pointer events fall inside one step; only a new step is a change worth drawing.
    if (delta === active.lastDelta) {
      return;
    }
    gesture.current = { ...active, lastDelta: delta };
    onChange?.(changeHoursRange(active.day, { ...active, limits }, delta));
  }
  function end(event: PointerEvent<HTMLElement>, cancel = false) {
    const active = gesture.current;
    if (active?.pointer !== event.pointerId) {
      return;
    }
    gesture.current = null;
    if (cancel) {
      onChange?.(active.day);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function key(event: KeyboardEvent<HTMLElement>, target: HoursTarget) {
    if (
      disabled ||
      onChange === undefined ||
      !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1;
    onChange(
      changeHoursRange(
        day,
        { ...target, limits },
        direction * (event.shiftKey ? LARGE_STEP_MINUTES : STEP_MINUTES),
      ),
    );
  }
  /** A press on the empty bar opens a range there; dragging on sets how long it is. */
  const track = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (
        disabled ||
        onChange === undefined ||
        event.button !== 0 ||
        event.target !== event.currentTarget
      ) {
        return;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      const minute =
        range.from +
        Math.round(
          (((event.clientX - bounds.left) / bounds.width) * (range.to - range.from)) / STEP_MINUTES,
        ) *
          STEP_MINUTES;
      const created = intervalAt(day, minute, limits);
      if (created === null) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        day: created.day,
        kind: 'intervals',
        index: created.index,
        part: 'end',
        pointer: event.pointerId,
        origin: event.clientX,
        width: bounds.width,
        range,
        lastDelta: 0,
      };
      onChange(created.day);
    },
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      end(event);
    },
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      end(event, true);
    },
  };
  return {
    segments: segmentsOf(day),
    track,
    bind: (kind: RangeKind, index: number, part: DragPart) => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        begin(event, { kind, index, part });
      },
      onPointerMove: move,
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        end(event);
      },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => {
        end(event, true);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        key(event, { kind, index, part });
      },
    }),
  };
}
