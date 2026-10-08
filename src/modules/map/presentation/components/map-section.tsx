import { I18nProvider } from '@components/providers/i18n-provider';

import { publicEnv } from '@lib/config';
import type { AppResult } from '@lib/result';

import { MapExplorer } from './map-explorer.client';

import type {
  MapConfig,
  MapHeight,
  MapLayerInput,
} from '../../application/contracts/map-constraints';
import type { MapModel } from '../../application/contracts/map-views';

export interface MapSectionProps {
  /** Names the map for assistive technology. */
  readonly heading: string;
  /** One entry per dataset. Untrusted: validated per feature by the use case. */
  readonly layers: readonly MapLayerInput[];
  readonly config: MapConfig;
  readonly height: MapHeight;
  /** Datasets the host could not load, so visitors learn the map is incomplete. */
  readonly unavailableLayers: number;
}

export interface MapSectionDependencies {
  readonly buildMapModel: (input: {
    readonly layers: readonly MapLayerInput[];
    readonly config: MapConfig;
  }) => AppResult<MapModel, never>;
}

/**
 * The server half of the map: the use case validates and profiles the data
 * and decides the visual encoding; the browser receives one plain model. The
 * client part never sees raw external data and never needs a data-source
 * credential. Built with its dependency by `composition.ts`.
 */
export function createMapSection({ buildMapModel }: MapSectionDependencies) {
  return function MapSection({
    heading,
    layers,
    config,
    height,
    unavailableLayers,
  }: MapSectionProps) {
    const result = buildMapModel({ layers, config });
    if (result.isErr()) {
      // `BuildMapModel` cannot fail today; this keeps the signature honest if it ever can.
      return null;
    }

    const accessToken = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    return (
      <I18nProvider namespaces={['map']}>
        <MapExplorer
          heading={heading}
          model={result.value}
          interaction={config.interaction}
          showLegend={config.showLegend}
          height={height}
          tiles={
            accessToken === undefined
              ? null
              : { accessToken, styleUrl: publicEnv.NEXT_PUBLIC_MAPBOX_STYLE_URL }
          }
          unavailableLayers={unavailableLayers}
        />
      </I18nProvider>
    );
  };
}
