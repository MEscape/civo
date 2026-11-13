'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface LocationFocus {
  /** The location the pointer or keyboard is on, in the list or on the map. */
  readonly activeId: string | null;
  /** The one last picked on the map, kept until another is. */
  readonly pickedId: string | null;
  readonly setActiveId: (id: string | null) => void;
  readonly pick: (id: string) => void;
}

const FocusContext = createContext<LocationFocus | null>(null);

/** Shares which location is in focus between the list and the map beside it. */
export function LocationFocusProvider({ children }: { readonly children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      activeId,
      pickedId,
      setActiveId,
      pick: (id: string) => {
        setPickedId(id);
      },
    }),
    [activeId, pickedId],
  );
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useLocationFocus(): LocationFocus {
  const focus = useContext(FocusContext);
  if (focus === null) {
    throw new Error('useLocationFocus needs a LocationFocusProvider');
  }
  return focus;
}

const ROW_PREFIX = 'location-row-';

/** The location a row of the table is for, read from the row's address of its own (`locationRowId`). */
function locationOf(target: EventTarget): string | null {
  const row = target instanceof Element ? target.closest(`[id^="${ROW_PREFIX}"]`) : null;
  return row === null ? null : row.id.slice(ROW_PREFIX.length);
}

/**
 * The table of locations as one hover and focus surface: the row under the pointer or the keyboard
 * is the location in focus, and the row of the focused location (hovered on its pin, or the last pin
 * picked) is marked and scrolled to. Listened to once here instead of on every row, and marked on the
 * row element itself: the rows stay the shared table's, which does not know about the map.
 */
export function LocationFocusScope({ children }: { readonly children: ReactNode }) {
  const { activeId, pickedId, setActiveId } = useLocationFocus();
  const focused = activeId ?? pickedId;

  useEffect(() => {
    if (focused === null) {
      return undefined;
    }
    const row = document.getElementById(`${ROW_PREFIX}${focused}`);
    row?.setAttribute('data-focused', 'true');
    return () => {
      row?.removeAttribute('data-focused');
    };
  }, [focused]);

  useEffect(() => {
    if (pickedId !== null) {
      document.getElementById(`${ROW_PREFIX}${pickedId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [pickedId]);

  return (
    // The wrapper only listens; the rows inside are the controls.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Pointer and focus events bubble up from the links in the rows.
    <div
      onMouseOver={(event) => {
        setActiveId(locationOf(event.target));
      }}
      onMouseLeave={() => {
        setActiveId(null);
      }}
      onFocus={(event) => {
        setActiveId(locationOf(event.target));
      }}
      onBlur={() => {
        setActiveId(null);
      }}
    >
      {children}
    </div>
  );
}
