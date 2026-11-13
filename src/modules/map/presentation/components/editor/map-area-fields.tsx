'use client';

import { useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { fitStartAreaToLocations } from '../../forms/fit-start-area';

import type { MapEditorValues } from '../../schemas/saved-map-schema';
import type { UseFormReturn } from 'react-hook-form';

interface MapAreaFieldsProps {
  readonly form: UseFormReturn<MapEditorValues>;
  readonly errorText: (message: string | undefined) => string | undefined;
  /** The preview shows an area that can become the start area. */
  readonly canUseVisibleArea: boolean;
  readonly onUseVisibleArea: () => void;
}

/**
 * The area a map opens on, set from the preview rather than typed as coordinates: move the preview
 * and take what it shows, or fit it around the locations (which happens on its own as they are
 * added).
 */
export function MapAreaFields({
  form,
  errorText,
  canUseVisibleArea,
  onUseVisibleArea,
}: MapAreaFieldsProps) {
  const t = useTranslations('map');
  const locations = useWatch({ control: form.control, name: 'settings.locations' });
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-copy">{t('management.area')}</h3>
        <p className="text-sm text-copy-muted">{t('management.areaHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canUseVisibleArea}
          onClick={onUseVisibleArea}
        >
          {t('management.useArea')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={(locations?.length ?? 0) === 0}
          onClick={() => {
            fitStartAreaToLocations(form);
          }}
        >
          {t('management.fitLocations')}
        </Button>
      </div>
      <FieldMessage
        id="map-bounds-error"
        message={errorText(
          form.formState.errors.settings?.initialBounds === undefined
            ? undefined
            : 'map.invalid_bounds',
        )}
      />
    </div>
  );
}
