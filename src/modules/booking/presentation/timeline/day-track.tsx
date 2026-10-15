'use client';

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { cn } from '@lib/utils';

import { formatTimeOfDay } from '../../application/contracts/booking-constraints';

import {
  HOUR_MINUTES,
  PERCENT,
  SNAP_MINUTES,
  addSpan,
  moveSpan,
  removeSpan,
  resizeSpan,
  sameSpans,
} from './spans';

import type { Span } from './spans';

/** A bar narrower than this share of the track shows no times (they are in its tooltip and name). */
const MIN_SHARE_FOR_TEXT = 0.1;

export type TrackTone = 'open' | 'pause';

export interface DayTrackLabels {
  /** Names a bar for assistive technology, e.g. `Monday: 08:00 to 16:00`. */
  readonly bar: (start: string, end: string) => string;
  readonly start: string;
  readonly end: string;
  readonly remove: string;
  /** Explains the keys once, for the bar's description. */
  readonly keys: string;
  /** What an empty track says it can do, e.g. `Click to add opening hours`. */
  readonly add: string;
}

export interface DayTrackProps {
  readonly spans: readonly Span[];
  /** Where bars may go; `null` means anywhere in the day. */
  readonly parents: readonly Span[] | null;
  /** The hours the track draws, the same for every day of a week. */
  readonly window: Span;
  readonly tone: TrackTone;
  /** How long a bar is when one is added by clicking. */
  readonly newLength: number;
  readonly disabled: boolean;
  readonly labels: DayTrackLabels;
  readonly onChange: (spans: Span[]) => void;
  /** A drag begins (`true`) or ends (`false`): the week keeps its scale while a bar is held. */
  readonly onGestureChange: (isActive: boolean) => void;
}

type Drag =
  | { readonly kind: 'move'; readonly index: number; readonly from: number }
  | { readonly kind: 'start' | 'end'; readonly index: number };

interface Gesture {
  readonly drag: Drag;
  /** The bars as they were when the drag began: every move is computed from them, not from the last move. */
  readonly origin: readonly Span[];
}

const TONE_CLASSES: Readonly<Record<TrackTone, string>> = {
  open: 'bg-primary text-primary-foreground',
  pause: 'border border-warning-border bg-warning-subtle text-warning',
};

function leftOf(minute: number, window: Span): number {
  return ((minute - window.start) / (window.end - window.start)) * PERCENT;
}

/**
 * One lane of a day: bars you can drag, resize, add by clicking an empty
 * stretch and take away again, all in quarter hours. The arithmetic is in
 * `spans.ts`; this only turns the pointer and the keys into it. Every bar is
 * reachable with the keyboard: arrow keys move it (Shift for an hour), its two
 * edges are sliders, and Delete removes it.
 *
 * A drag belongs to the lane itself, which captures the pointer: the bars
 * change under the finger while it moves, so no bar can be what holds on to
 * it. The pointer may leave the lane and come back, and the drag ends exactly
 * when the button is released, wherever that is.
 */
export function DayTrack({
  spans,
  parents,
  window,
  tone,
  newLength,
  disabled,
  labels,
  onChange,
  onGestureChange,
}: DayTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Bars stay inside the hours the lane draws, so a drag past its end stops there.
  const limits = parents ?? [window];
  const lane = { spans, parents: limits };

  function minuteAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) {
      return window.start;
    }
    return window.start + ((clientX - rect.left) / rect.width) * (window.end - window.start);
  }

  function change(next: readonly Span[]) {
    if (!sameSpans(next, spans)) {
      onChange([...next]);
    }
  }

  function begin(event: PointerEvent<HTMLElement>, drag: Drag) {
    if (disabled || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    trackRef.current?.setPointerCapture(event.pointerId);
    gesture.current = { drag, origin: spans };
    onGestureChange(true);
  }

  function dragTo(event: PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (current === null) {
      return;
    }
    const { drag, origin } = current;
    const minute = minuteAt(event.clientX);
    const held = { spans: origin, parents: limits };
    change(
      drag.kind === 'move'
        ? moveSpan(held, drag.index, minute - drag.from)
        : resizeSpan(held, drag.index, { edge: drag.kind, to: minute }),
    );
  }

  function finish() {
    if (gesture.current !== null) {
      gesture.current = null;
      onGestureChange(false);
    }
  }

  function addAt(event: PointerEvent<HTMLElement>) {
    if (disabled || event.button !== 0) {
      return;
    }
    const added = addSpan(lane, { at: minuteAt(event.clientX), length: newLength });
    if (added !== null) {
      change(added);
    }
  }

  function step(event: KeyboardEvent): number {
    return event.shiftKey ? HOUR_MINUTES : SNAP_MINUTES;
  }

  function keyOnBar(event: KeyboardEvent<HTMLElement>, index: number) {
    if (disabled) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      change(removeSpan(spans, index));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const sign = event.key === 'ArrowLeft' ? -1 : 1;
      change(moveSpan(lane, index, sign * step(event)));
    }
  }

  function keyOnEdge(event: KeyboardEvent<HTMLElement>, index: number, edge: 'start' | 'end') {
    if (disabled || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const span = spans[index];
    if (span === undefined) {
      return;
    }
    const sign = event.key === 'ArrowLeft' ? -1 : 1;
    change(resizeSpan(lane, index, { edge, to: span[edge] + sign * step(event) }));
  }

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-full w-full touch-none overflow-hidden rounded-token-sm',
        parents === null ? 'bg-surface' : 'bg-border/50',
        'border border-border',
        !disabled && 'cursor-copy',
      )}
      onPointerDown={addAt}
      onPointerMove={dragTo}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      {limits.map((area) => (
        <div
          key={`${area.start}-${area.end}`}
          aria-hidden="true"
          className="absolute inset-y-0 bg-surface"
          style={{
            left: `${leftOf(area.start, window)}%`,
            width: `${leftOf(area.end, window) - leftOf(area.start, window)}%`,
          }}
        />
      ))}
      {spans.length === 0 && !disabled && (
        <p className="pointer-events-none absolute inset-0 flex items-center px-2 text-xs text-copy-muted">
          {labels.add}
        </p>
      )}
      {spans.map((span, index) => {
        const from = formatTimeOfDay(span.start);
        const to = formatTimeOfDay(span.end);
        const left = leftOf(span.start, window);
        return (
          <div
            // The bar at a position stays the same element while it is dragged: a key made of
            // its times would remount it on every move and drop the drag.
            // eslint-disable-next-line react/no-array-index-key -- see above
            key={index}
            className={cn(
              'group/bar absolute inset-y-0.5 flex items-center rounded-token-sm text-xs font-medium',
              TONE_CLASSES[tone],
            )}
            style={{ left: `${left}%`, width: `${leftOf(span.end, window) - left}%` }}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={labels.bar(from, to)}
              title={`${from}–${to}. ${labels.keys}`}
              className={cn(
                'h-full min-w-0 flex-1 justify-start truncate rounded-none px-2.5 text-xs font-medium text-inherit hover:bg-transparent hover:text-inherit',
                !disabled && 'cursor-grab active:cursor-grabbing',
              )}
              onPointerDown={(event) => {
                begin(event, { kind: 'move', index, from: minuteAt(event.clientX) });
              }}
              onKeyDown={(event) => {
                keyOnBar(event, index);
              }}
            >
              {(span.end - span.start) / (window.end - window.start) >= MIN_SHARE_FOR_TEXT
                ? `${from}–${to}`
                : null}
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={labels.remove}
                className="mr-1 hidden size-4 shrink-0 p-0 text-inherit group-focus-within/bar:flex group-hover/bar:flex hover:bg-surface/30 hover:text-inherit"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  change(removeSpan(spans, index));
                }}
              >
                <Icons.close className="size-3" aria-hidden="true" />
              </Button>
            )}
            {(['start', 'end'] as const).map((edge) => (
              <span
                key={edge}
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={edge === 'start' ? labels.start : labels.end}
                aria-orientation="horizontal"
                aria-valuemin={window.start}
                aria-valuemax={window.end}
                aria-valuenow={span[edge]}
                aria-valuetext={edge === 'start' ? from : to}
                aria-disabled={disabled || undefined}
                className={cn(
                  'absolute inset-y-0 w-2 max-w-1/3 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  edge === 'start' ? '-left-0.5' : '-right-0.5',
                  !disabled && 'cursor-ew-resize hover:bg-accent/40',
                )}
                onPointerDown={(event) => {
                  begin(event, { kind: edge, index });
                }}
                onKeyDown={(event) => {
                  keyOnEdge(event, index, edge);
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
