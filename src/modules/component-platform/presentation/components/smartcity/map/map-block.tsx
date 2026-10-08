import type { ComponentType } from 'react';

import type { MapLayerInput, MapSectionProps } from '@modules/map';

import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import { geoFeatureToMapFeature, toLayer } from './to-map-layers';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type {
  ContentLoadError,
  ContentOrigin,
} from '../../../../application/contracts/content-views';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MapBlockProps {
  readonly props: ComponentProps<'map'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
  /** The map module's section, handed in by `composition.ts`. */
  readonly mapSection: ComponentType<MapSectionProps>;
}

/** A map shows every feature of its datasets; the data-sources mapping already caps a dataset at this size. */
const FEATURE_LIMIT = 1_000;

interface Slot {
  readonly layerId: string;
  readonly label: string;
  readonly datasetId: string | undefined;
}

interface LoadedLayer {
  readonly layer: MapLayerInput | null;
  readonly origin: ContentOrigin | null;
  readonly error: ContentLoadError | null;
}

async function loadSlot(
  slot: Slot,
  context: RenderContext,
  loadContent: LoadContent,
): Promise<LoadedLayer> {
  const result = await loadContent({
    kind: 'GeoFeature',
    mode: context.mode,
    websiteId: context.websiteId,
    datasetId: slot.datasetId,
    limit: FEATURE_LIMIT,
  });
  return result.match<LoadedLayer>(
    (view) => ({
      layer: toLayer(slot.layerId, slot.label, view.items.map(geoFeatureToMapFeature)),
      origin: view.origin,
      error: null,
    }),
    (error) => ({ layer: null, origin: null, error }),
  );
}

/**
 * Binds the editor's datasets to the map module. The component platform
 * owns WHICH datasets a page uses and how their records are loaded and
 * validated against the canonical contracts; the map owns what is drawn.
 *
 * Only datasets the editor chose are loaded. With none chosen, the editor
 * canvas shows labelled sample features and a published page shows an empty
 * map, never invented data.
 */
export async function MapBlock({
  props,
  context,
  loadContent,
  mapSection: MapSection,
}: MapBlockProps) {
  const t = await getTranslations('componentPlatform');
  const heading = trimToNull(props.heading) ?? t('map.defaultHeading');

  const slots: readonly Slot[] = [
    {
      layerId: 'primary',
      label: t('map.layers.primary'),
      datasetId: props.primaryDatasetId,
    },
    {
      layerId: 'secondary',
      label: t('map.layers.secondary'),
      datasetId: props.secondaryDatasetId,
    },
  ];
  const bound = slots.filter((slot) => trimToNull(slot.datasetId) !== null);
  // Nothing chosen yet: still ask once, so the editor sees sample data and visitors an empty map.
  const requested = bound.length > 0 ? bound : slots.slice(0, 1);

  const loaded = await Promise.all(requested.map((slot) => loadSlot(slot, context, loadContent)));

  const failed = loaded.filter((entry) => entry.error !== null).length;
  if (failed === loaded.length) {
    return <ContentState kind="error" heading={heading} />;
  }

  const layers = loaded.flatMap((entry) => (entry.layer === null ? [] : [entry.layer]));
  const sample = loaded.find((entry) => entry.origin?.kind === 'sample')?.origin ?? null;

  return (
    <Section className="relative">
      {sample !== null && <ContentOriginBadge origin={sample} />}
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <MapSection
          heading={heading}
          layers={layers}
          config={{
            pointStyle: props.pointStyle,
            colorBy: trimToNull(props.colorBy) ?? undefined,
            sizeBy: trimToNull(props.sizeBy) ?? undefined,
            interaction: props.interaction,
            showFilters: props.showFilters,
            showLegend: props.showLegend,
          }}
          height={props.height}
          unavailableLayers={failed}
        />
      </Container>
    </Section>
  );
}
