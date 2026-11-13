import type { ComponentType } from 'react';

import type { MapSectionProps } from '@modules/map';

import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import { loadMapBlock } from './load-map-block';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MapBlockProps {
  readonly props: ComponentProps<'map'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
  /** The map module's section, handed in by `composition.ts`. */
  readonly mapSection: ComponentType<MapSectionProps>;
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

  const { layers, failed, requested, sample, isTruncated, config, savedMap, inlineMap } =
    await loadMapBlock({
      props,
      context,
      loadContent,
      heading,
      labels: { primary: t('map.layers.primary'), secondary: t('map.layers.secondary') },
    });
  if (failed === requested) {
    return <ContentState kind="error" heading={heading} />;
  }

  return (
    <Section className="relative">
      {sample !== null && <ContentOriginBadge origin={sample} />}
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <MapSection
          heading={heading}
          layers={layers}
          config={config}
          savedMap={savedMap}
          inlineMap={inlineMap}
          height={props.height}
          unavailableLayers={failed}
          isTruncated={isTruncated}
        />
      </Container>
      <MapAttribution props={props} context={context} loadContent={loadContent} />
    </Section>
  );
}

/** Inline-map provenance uses a one-record metadata read; feature pagination stays owned by the map module. */
async function MapAttribution({ props, context, loadContent }: Omit<MapBlockProps, 'mapSection'>) {
  const datasets = [props.primaryDatasetId, props.secondaryDatasetId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const results = await Promise.all(
    datasets.map((datasetId) =>
      loadContent({
        kind: 'GeoFeature',
        mode: context.mode,
        websiteId: context.websiteId,
        datasetId,
        limit: 1,
      }),
    ),
  );
  return (
    <>
      {results.map((result, index) =>
        result.isOk() && result.value.origin.kind === 'live' ? (
          <ContentOriginBadge key={datasets[index]} origin={result.value.origin} />
        ) : null,
      )}
    </>
  );
}
