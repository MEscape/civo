'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { SyntheticEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';
import { useWizardSteps } from '@hooks/use-wizard-steps';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';
import { isBlank } from '@lib/utils';

import { DEFAULT_MAP_BOUNDS } from '../../application/contracts/map-constraints';
import { SAVED_MAP_LIMITS } from '../../application/contracts/saved-map-views';
import { saveMapAction } from '../actions/save-map-action';
import { CREATED_PARAM, MAP_EDITOR_STEPS, MAP_STEP_FIELDS } from '../forms/map-editor-steps';
import { messageKeyForCode } from '../messages/message-keys';
import { mapRoutes } from '../routes';
import { savedMapDraftSchema } from '../schemas/saved-map-schema';

import { useMapPreview } from './use-map-preview';

import type { SavedMapView } from '../../application/contracts/saved-map-views';
import type { MapEditorStep } from '../forms/map-editor-steps';
import type { MapEditorValues } from '../schemas/saved-map-schema';

export type { MapEditorValues } from '../schemas/saved-map-schema';

function initialValues(map: SavedMapView | null): MapEditorValues {
  return map === null
    ? {
        name: '',
        description: '',
        settings: {
          isPublic: false,
          layers: [],
          locations: [],
          initialBounds: [...DEFAULT_MAP_BOUNDS],
          featureLimit: SAVED_MAP_LIMITS.features,
          pointStyle: 'markers',
          interaction: 'details',
          height: 'standard',
          showFilters: true,
          showLegend: true,
          colorBy: '',
          sizeBy: '',
        },
      }
    : {
        name: map.name,
        description: map.description,
        settings: {
          ...map.settings,
          layers: map.settings.layers.map((layer) => ({ ...layer })),
          locations: (map.settings.locations ?? []).map((location) => ({ ...location })),
          initialBounds: [...map.settings.initialBounds],
        },
      };
}

interface MapEditorOptions {
  readonly websiteId: string;
  readonly initialMap: SavedMapView | null;
  readonly step: MapEditorStep;
  /** The map was just created: the first screen of it says so. */
  readonly isCreated: boolean;
}

/** The state of the map editor: the form and its steps, the save, and the live preview. */
export function useMapEditor({ websiteId, initialMap, step, isCreated }: MapEditorOptions) {
  const router = useRouter();
  const t = useTranslations('map');
  const [saved, setSaved] = useState(initialMap);
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(isCreated);
  const [contentMode, setContentMode] = useState<'locations' | 'datasets'>(
    initialMap?.settings.layers.length ? 'datasets' : 'locations',
  );
  const form = useForm<MapEditorValues>({
    resolver: zodResolver(savedMapDraftSchema),
    defaultValues: initialValues(initialMap),
  });
  const { isDirty } = form.formState;
  useReportUnsavedChanges(isDirty);
  const steps = useWizardSteps({ steps: MAP_EDITOR_STEPS, fields: MAP_STEP_FIELDS, step, form });
  const preview = useMapPreview(websiteId, form, t('management.preview'));
  const latest = useRef({ saved, reset: preview.resetView });
  useEffect(() => {
    latest.current = { saved, reset: preview.resetView };
  });
  // The page stays mounted while hidden, and hiding runs this cleanup: whatever was changed and not
  // saved, or the map moved to, is gone when the person comes back, as after a fresh load.
  useEffect(
    () => () => {
      form.reset(initialValues(latest.current.saved));
      latest.current.reset();
    },
    [form],
  );
  const name = useWatch({ control: form.control, name: 'name' });
  const height = useWatch({ control: form.control, name: 'settings.height' });

  function save(values: MapEditorValues) {
    setFormErrorCode(null);
    setHasSaved(false);
    startTransition(async () => {
      const result = await saveMapAction({
        ...values,
        websiteId,
        ...(saved === null ? {} : { id: saved.id, version: saved.version }),
      });
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError));
        steps.showErrors(Object.keys(result.error.fieldErrors ?? {}));
        return;
      }
      form.reset(initialValues(result.data));
      if (saved === null) {
        // The map's own page: it says the map was saved and where it goes next.
        router.replace(`${mapRoutes.edit(websiteId, result.data.id)}?${CREATED_PARAM}=1`);
        return;
      }
      setSaved(result.data);
      setHasSaved(true);
    });
  }

  return {
    form,
    steps,
    contentMode,
    setContentMode,
    preview,
    heading: isBlank(name) ? t('management.preview') : name,
    height,
    onSubmit: (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!steps.isLast) {
        void steps.goNext();
        return;
      }
      void form.handleSubmit(save, (invalid) => {
        steps.showErrors(Object.keys(invalid));
      })(event);
    },
    isPending,
    showSaved: hasSaved && !isDirty,
    formError:
      formErrorCode === null ? undefined : t(messageKeyForCode(formErrorCode, 'management.failed')),
    /** A field's error code as text in this module's language; `undefined` while the field is valid. */
    fieldError: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code, 'management.invalid')),
    useVisibleArea: () => {
      if (preview.visibleBounds !== null) {
        form.setValue('settings.initialBounds', [...preview.visibleBounds], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
  };
}
