import type { ComponentProps } from 'react';

import { MapFilters } from './map-filters';
import { MapLegend } from './map-legend';

import type { MapModel } from '../../../application/contracts/map-views';

/** One column when nothing stands beside the map; the map and a third for its filters and legend otherwise. */
export function layoutOf(hasSidebar: boolean) {
  return hasSidebar
    ? { hasSidebar, grid: '@4xl:grid-cols-3', main: '@4xl:col-span-2' }
    : { hasSidebar, grid: '', main: '' };
}

interface MapSidebarProps {
  readonly model: MapModel;
  readonly filterState: ComponentProps<typeof MapFilters>['state'];
  readonly onFilterChange: ComponentProps<typeof MapFilters>['onChange'];
  readonly onReset: () => void;
  readonly showLegend: boolean;
}

/** The filters and the legend, beside the map. */
export function MapSidebar({
  model,
  filterState,
  onFilterChange,
  onReset,
  showLegend,
}: MapSidebarProps) {
  return (
    <div className="min-w-0 space-y-4 @4xl:col-span-1">
      <MapFilters
        definitions={model.filters}
        state={filterState}
        onChange={onFilterChange}
        onReset={onReset}
      />
      {showLegend && <MapLegend layers={model.layers} styles={model.styles} />}
    </div>
  );
}
