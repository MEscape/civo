'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActionResult } from '@lib/result';
import { debounce } from '@lib/utils';

import { MAP_VIEWPORT_LIMITS, padViewport } from '../../application/contracts/map-constraints';

import type { Bounds } from '../../application/contracts/map-constraints';
import type { MapModel } from '../../application/contracts/map-views';

export type LoadMapWindow = (bounds: Bounds) => Promise<ActionResult<MapModel>>;

/** Whether `inner` lies within `outer`: everything that can be seen there was already asked for. */
function isInside(inner: Bounds, outer: Bounds): boolean {
  return (
    inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3]
  );
}

/**
 * One padded batch at a time. A newer movement invalidates in-flight work before its debounce expires.
 * Moving or zooming inside the area the batch was asked for needs no new request: it holds every
 * location there, as long as it was not cut short. Leaving that area (panning past the padding, or
 * zooming out) asks for the new, padded area, which replaces the batch: nothing is added twice.
 */
export function useMapWindow(
  initialModel: MapModel,
  load: LoadMapWindow,
  onBoundsChange?: (bounds: Bounds) => void,
) {
  const [model, setModel] = useState(initialModel);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [shownInitial, setShownInitial] = useState(initialModel);
  const generation = useRef(0);
  const latest = useRef({ load, onBoundsChange });
  const schedule = useRef<ReturnType<typeof debounce> | null>(null);
  const lastBounds = useRef<Bounds | null>(null);
  // The area the shown batch was asked for, and whether the batch was cut short.
  const loaded = useRef<{ readonly area: Bounds; readonly isTruncated: boolean } | null>(null);
  // A host that hands in a new model (the editor's live preview) replaces the batch in place,
  // without rebuilding the map; a batch still on its way for the old one is then dropped.
  if (initialModel !== shownInitial) {
    setShownInitial(initialModel);
    setModel(initialModel);
    setState('idle');
  }
  useEffect(() => {
    ++generation.current;
    schedule.current?.cancel();
    loaded.current = null;
  }, [initialModel]);
  useEffect(() => {
    latest.current = { load, onBoundsChange };
  }, [load, onBoundsChange]);

  const request = useCallback((bounds: Bounds) => {
    const current = ++generation.current;
    setState('loading');
    schedule.current?.cancel();
    const run = async () => {
      try {
        const area = padViewport(bounds, MAP_VIEWPORT_LIMITS.padding);
        const result = await latest.current.load(area);
        if (current !== generation.current) {
          return;
        }
        if (result.ok) {
          loaded.current = { area, isTruncated: result.data.isTruncated === true };
          setModel(result.data);
          setState('idle');
        } else {
          setState('failed');
        }
      } catch {
        if (current === generation.current) {
          setState('failed');
        }
      }
    };
    const execute = debounce(() => {
      void run();
    }, MAP_VIEWPORT_LIMITS.debounceMs);
    schedule.current = execute;
    execute();
  }, []);

  const handleViewportChange = useCallback(
    (bounds: Bounds) => {
      latest.current.onBoundsChange?.(bounds);
      const previous = lastBounds.current;
      lastBounds.current = bounds;
      if (previous?.every((coordinate, index) => coordinate === bounds[index]) === true) {
        return;
      }
      const covered = loaded.current;
      if (covered !== null && !covered.isTruncated && isInside(bounds, covered.area)) {
        // Already loaded and complete: a request still on its way is no longer needed either.
        ++generation.current;
        schedule.current?.cancel();
        setState('idle');
        return;
      }
      request(bounds);
    },
    [request],
  );

  useEffect(
    () => () => {
      ++generation.current;
      schedule.current?.cancel();
    },
    [],
  );

  return {
    model,
    state,
    handleViewportChange,
    retry: () => {
      if (lastBounds.current !== null) {
        request(lastBounds.current);
      }
    },
  };
}
