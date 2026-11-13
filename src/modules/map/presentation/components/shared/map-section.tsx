import { I18nProvider } from '@components/providers/i18n-provider';

import { mapTiles } from '@lib/config';
import type { AppResult } from '@lib/result';

import { MapExplorer } from '../explorer/map-explorer.client';

import { InlineMapSection } from './inline-map-section';
import { SavedMapSection } from './saved-map-section';

import type { InlineMapTarget } from './inline-map-section';
import type { SavedMapTarget } from './saved-map-section';
import type {
  MapConfig,
  MapHeight,
  MapLayerInput,
} from '../../../application/contracts/map-constraints';
import type { MapModel } from '../../../application/contracts/map-views';

export interface MapSectionProps {
  readonly savedMap?: SavedMapTarget | undefined;
  readonly inlineMap?: InlineMapTarget | undefined;
  /** Names the map for assistive technology. */
  readonly heading: string;
  /** One entry per dataset. Untrusted: validated per feature by the use case. */
  readonly layers: readonly MapLayerInput[];
  readonly config: MapConfig;
  readonly height: MapHeight;
  /** Datasets the host could not load, so visitors learn the map is incomplete. */
  readonly unavailableLayers: number;
  readonly isTruncated?: boolean | undefined;
}

export interface MapSectionDependencies {
  readonly buildMapModel: (input: {
    readonly layers: readonly MapLayerInput[];
    readonly config: MapConfig;
    readonly isTruncated?: boolean | undefined;
  }) => AppResult<MapModel, never>;
}

// @truncation none Forwarded into the map model; MapExplorer renders the notice for `model.isTruncated`.

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
    isTruncated,
    savedMap,
    inlineMap,
  }: MapSectionProps) {
    if (savedMap !== undefined) {
      return <SavedMapSection {...savedMap} />;
    }
    if (inlineMap !== undefined) {
      return <InlineMapSection {...inlineMap} />;
    }
    const result = buildMapModel({ layers, config, isTruncated });
    if (result.isErr()) {
      // `BuildMapModel` cannot fail today; this keeps the signature honest if it ever can.
      return null;
    }

    return (
      <I18nProvider namespaces={['map']}>
        <MapExplorer
          heading={heading}
          model={result.value}
          interaction={config.interaction}
          showLegend={config.showLegend}
          height={height}
          tiles={mapTiles()}
          unavailableLayers={unavailableLayers}
        />
      </I18nProvider>
    );
  };
}
