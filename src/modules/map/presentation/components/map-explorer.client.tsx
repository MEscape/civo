'use client';

import { useId, useMemo, useState } from 'react';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { filterFeatures } from '../../application/contracts/map-constraints';
import { messageKeyForCode } from '../messages/message-keys';

import { FeatureDetails } from './feature-details';
import { FeatureList } from './feature-list';
import { MapCanvas } from './map-canvas.client';
import { MapFilters } from './map-filters';
import { MapLegend } from './map-legend';

import type { MapTiles } from './map-canvas.client';
import type {
  FeatureInteraction,
  FilterState,
  FilterValue,
  MapFeature,
  MapHeight,
} from '../../application/contracts/map-constraints';
import type { MapModel } from '../../application/contracts/map-views';
import type { CreateMapRenderer } from '../mapbox/create-mapbox-renderer';

export interface MapExplorerProps {
  readonly heading: string;
  readonly model: MapModel;
  readonly interaction: FeatureInteraction;
  readonly showLegend: boolean;
  readonly height: MapHeight;
  /** `null`: no map background is configured; everything but the canvas still works. */
  readonly tiles: MapTiles | null;
  /** Data layers that could not be loaded at all. */
  readonly unavailableLayers: number;
  /** Replaces the Mapbox renderer; for tests. */
  readonly createRenderer?: CreateMapRenderer;
}

const HEIGHT_CLASSES: Record<MapHeight, string> = {
  compact: 'h-72',
  standard: 'h-96',
  tall: 'h-96 md:h-144',
};

/** Mapbox GL JS is large and only needed once a map is shown, so it loads on demand. */
const loadMapboxRenderer: CreateMapRenderer = async (options) => {
  const { createMapboxRenderer } = await import('../mapbox/create-mapbox-renderer');
  return createMapboxRenderer(options);
};

type CanvasStatus = 'pending' | 'ready' | 'failed';

function Note({ children }: { readonly children: string }) {
  return (
    <p
      role="status"
      className="rounded-token border border-border bg-surface px-4 py-3 text-sm text-copy-muted"
    >
      {children}
    </p>
  );
}

interface MapNotesProps {
  readonly model: MapModel;
  readonly unavailableLayers: number;
  readonly hasTiles: boolean;
  readonly hasCanvasFailed: boolean;
}

/** Everything that tells a visitor the map is incomplete, unavailable or empty, as text. */
function MapNotes({ model, unavailableLayers, hasTiles, hasCanvasFailed }: MapNotesProps) {
  const t = useTranslations('map');
  const hasFeatures = model.featureCount > 0;

  return (
    <>
      {unavailableLayers > 0 && (
        <Note>{t('states.layersUnavailable', { count: unavailableLayers })}</Note>
      )}
      {model.issues.dropped > 0 && (
        <div className="space-y-1">
          <Note>
            {t('states.skipped', { dropped: model.issues.dropped, total: model.issues.received })}
          </Note>
          <ul className="list-inside list-disc px-4 text-sm text-copy-muted">
            {Object.entries(model.issues.byReason).map(([code, count]) => (
              <li key={code}>
                {t('states.skippedReason', { reason: t(messageKeyForCode(code)), count })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!hasFeatures && <Note>{t('states.empty')}</Note>}
      {hasFeatures && !hasTiles && <Note>{t('states.tilesUnavailable')}</Note>}
      {hasFeatures && hasCanvasFailed && <Note>{t('states.failed')}</Note>}
    </>
  );
}

/** The selected feature, while the filters still show it. */
function findVisible(
  visible: ReadonlyArray<{ readonly features: readonly MapFeature[] }>,
  key: string | null,
): MapFeature | undefined {
  return key === null
    ? undefined
    : visible.flatMap((entry) => entry.features).find((feature) => feature.key === key);
}

/** How many locations pass the filters, announced politely as they change. */
function MapSummary({ shown, total }: { readonly shown: number; readonly total: number }) {
  const t = useTranslations('map');
  return (
    <p role="status" className="text-sm text-copy-muted">
      {shown === 0 ? t('states.noMatches') : t('summary', { shown, total })}
    </p>
  );
}

/** Where a feature links to, when the map opens links instead of details and the feature has one. */
function linkOf(model: MapModel, key: string | null): string | undefined {
  if (key === null) {
    return undefined;
  }
  return model.layers.flatMap((layer) => layer.features).find((candidate) => candidate.key === key)
    ?.href;
}

/**
 * The interactive part of the map: canvas, filters, legend, details and the
 * list alternative. All state is local and small (filters, selection); the
 * data was validated on the server, so nothing here parses external input.
 */
export function MapExplorer({
  heading,
  model,
  interaction,
  showLegend,
  height,
  tiles,
  unavailableLayers,
  createRenderer = loadMapboxRenderer,
}: MapExplorerProps) {
  const t = useTranslations('map');
  const router = useRouter();
  const [filterState, setFilterState] = useState<FilterState>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>('pending');

  // Memoized because the canvas re-syncs Mapbox sources whenever this identity changes.
  const visible = useMemo(
    () =>
      model.layers.map((layer) => ({
        layerId: layer.id,
        layer,
        features: filterFeatures(layer, filterState),
      })),
    [model.layers, filterState],
  );

  const shown = visible.reduce((sum, entry) => sum + entry.features.length, 0);
  const selected = findVisible(visible, selectedKey);
  const visibleSelectedKey = selected?.key ?? null;
  const hintId = useId();

  const isSelectable = interaction !== 'none';
  const canShowCanvas = tiles !== null && model.featureCount > 0 && canvasStatus !== 'failed';

  function handleFilterChange(field: string, value: FilterValue | null): void {
    setFilterState((current) => {
      const { [field]: _removed, ...rest } = current;
      return value === null ? rest : { ...rest, [field]: value };
    });
  }

  function handleSelect(key: string | null): void {
    if (!isSelectable) {
      return;
    }
    const href = interaction === 'link' ? linkOf(model, key) : undefined;
    if (href === undefined) {
      setSelectedKey(key);
    } else if (href.startsWith('/')) {
      // A path of this site navigates in the app; anything else leaves it.
      router.push(href);
    } else {
      window.location.assign(href);
    }
  }

  function handleListSelect(key: string): void {
    handleSelect(key);
    setFocusKey(key);
  }

  return (
    <div className="space-y-4">
      <MapNotes
        model={model}
        unavailableLayers={unavailableLayers}
        hasTiles={tiles !== null}
        hasCanvasFailed={canvasStatus === 'failed'}
      />

      {model.featureCount > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="order-2 space-y-4 lg:order-1 lg:col-span-1">
            <MapFilters
              definitions={model.filters}
              state={filterState}
              onChange={handleFilterChange}
              onReset={() => {
                setFilterState({});
              }}
            />
            {showLegend && <MapLegend layers={model.layers} styles={model.styles} />}
          </div>

          <div className="order-1 space-y-4 lg:order-2 lg:col-span-2">
            {canShowCanvas && (
              <div
                role="group"
                aria-label={t('canvas.label', { heading })}
                aria-describedby={hintId}
                className={cn(
                  'overflow-hidden rounded-token border border-border bg-canvas',
                  HEIGHT_CLASSES[height],
                )}
              >
                <MapCanvas
                  tiles={tiles}
                  styles={model.styles}
                  layers={visible}
                  initialBounds={model.bounds}
                  selectedKey={visibleSelectedKey}
                  focusKey={focusKey}
                  isSelectable={isSelectable}
                  onSelect={handleSelect}
                  onStatusChange={(status) => {
                    setCanvasStatus(status);
                  }}
                  createRenderer={createRenderer}
                />
              </div>
            )}
            <p id={hintId} className="sr-only">
              {t('canvas.hint')}
            </p>
            <MapSummary shown={shown} total={model.featureCount} />
            {selected !== undefined && (
              <FeatureDetails
                feature={selected}
                onClose={() => {
                  setSelectedKey(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      <FeatureList
        layers={visible}
        selectedKey={visibleSelectedKey}
        onSelect={isSelectable ? handleListSelect : null}
      />
    </div>
  );
}
