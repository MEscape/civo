'use client';

import { useEffect, useRef, useState } from 'react';

import { useWatch } from 'react-hook-form';

import { MAP_VIEWPORT_LIMITS, padViewport } from '../../application/contracts/map-constraints';
import { previewMapWindowAction } from '../actions/preview-map-window-action';
import { savedMapSettingsSchema } from '../schemas/saved-map-schema';

import type { Bounds, FieldProfile } from '../../application/contracts/map-constraints';
import type { MapModel } from '../../application/contracts/map-views';
import type { MapEditorValues } from '../schemas/saved-map-schema';
import type { DeepPartial, UseFormReturn } from 'react-hook-form';

/**
 * How long the form must rest before the preview is drawn again. Each draw is one read of the
 * window budget (120 a minute), so typing a name never spends more than one.
 */
export const PREVIEW_DEBOUNCE_MS = 700;

/**
 * The draft the preview draws, or `null` while the settings are not yet a valid map. Only the
 * settings change the picture, so a name or description being typed draws nothing.
 */
export function previewDraftOf(
  values: DeepPartial<MapEditorValues>,
  name: string,
): MapEditorValues | null {
  const settings = savedMapSettingsSchema.safeParse(values.settings);
  return settings.success ? { name, description: null, settings: settings.data } : null;
}

/** The attributes the layers of a picture offer, one per name: what a map can be coloured or sized by. */
function attributesOf(model: MapModel | undefined): readonly FieldProfile[] {
  const byKey = new Map<string, FieldProfile>();
  for (const layer of model?.layers ?? []) {
    for (const field of layer.fields) {
      if (!byKey.has(field.key)) {
        byKey.set(field.key, field);
      }
    }
  }
  return [...byKey.values()];
}

/**
 * The live preview of the editor's draft: drawn again shortly after every valid change, never
 * while the settings are incomplete, and the last good picture stays while the next one loads.
 * It has its own pending state, so drawing never locks the form or reads as saving.
 */
export function useMapPreview(
  websiteId: string,
  form: UseFormReturn<MapEditorValues>,
  /** Names the draft for the server; the heading on screen is the form's current name. */
  previewName: string,
) {
  const values = useWatch({ control: form.control });
  const [preview, setPreview] = useState<{ draft: MapEditorValues; model: MapModel } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [visibleBounds, setVisibleBounds] = useState<Bounds | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const viewport = useRef<Bounds | null>(null);
  const drawn = useRef<string | null>(null);
  const generation = useRef(0);

  const draft = previewDraftOf(values, previewName);
  // Compared by value: the watched values are a fresh object on every render.
  const key = draft === null ? null : JSON.stringify(draft);

  useEffect(() => {
    if (key === null || key === drawn.current) {
      return undefined;
    }
    const next = JSON.parse(key) as MapEditorValues;
    // The first picture of a saved map is drawn at once; later ones wait until the form rests.
    const delay = drawn.current === null && attempt === 0 ? 0 : PREVIEW_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      drawn.current = key;
      const current = ++generation.current;
      setIsDrawing(true);
      void previewMapWindowAction({
        websiteId,
        draft: next,
        // Where the person is looking, so a restyle does not empty the visible area.
        bounds: padViewport(
          viewport.current ?? next.settings.initialBounds,
          MAP_VIEWPORT_LIMITS.padding,
        ),
      })
        .catch(() => null)
        .then((result) => {
          if (current !== generation.current) {
            return;
          }
          setIsDrawing(false);
          if (result?.ok === true) {
            setPreview({ draft: next, model: result.data });
            setErrorCode(null);
          } else {
            setErrorCode(result?.error.code ?? 'map.source_failed');
          }
        });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [key, attempt, websiteId]);

  useEffect(
    () => () => {
      ++generation.current;
    },
    [],
  );

  return {
    preview,
    /** The attributes of the connected data the picture was drawn from, each once. */
    attributes: attributesOf(preview?.model),
    isDrawing,
    errorCode,
    visibleBounds,
    /** Changes whenever the view starts over, so the map is drawn again from the start area. */
    viewKey,
    /** Back to the start area: forgets where the map was moved to, and draws it again. */
    resetView: () => {
      viewport.current = null;
      drawn.current = null;
      setVisibleBounds(null);
      setViewKey((count) => count + 1);
      setAttempt((count) => count + 1);
    },
    onBoundsChange: (bounds: Bounds) => {
      viewport.current = bounds;
      setVisibleBounds(bounds);
    },
    retry: () => {
      drawn.current = null;
      setAttempt((count) => count + 1);
    },
  };
}
