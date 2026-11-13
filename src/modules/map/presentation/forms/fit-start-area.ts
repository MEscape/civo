import { boundsForLocations } from '../../application/contracts/map-constraints';

import type { MapEditorValues } from '../schemas/saved-map-schema';
import type { UseFormReturn } from 'react-hook-form';

/** The start area that shows every location, so a place just found is in view at once. */
export function fitStartAreaToLocations(form: UseFormReturn<MapEditorValues>): void {
  const bounds = boundsForLocations(form.getValues('settings.locations') ?? []);
  if (bounds !== null) {
    form.setValue('settings.initialBounds', [...bounds], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }
}
