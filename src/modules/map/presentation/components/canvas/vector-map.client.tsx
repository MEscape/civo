'use client';

import { useId, useState } from 'react';

import { Minus, Plus } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { MAP_FRAME_CLASS, MAP_HEIGHT_CLASSES } from './map-frame';
import {
  vectorFeatures,
  vectorPaths,
  vectorHeat,
  vectorProjection,
  vectorViewBox,
} from './vector-projection';

import type { Bounds, MapFeature, MapHeight } from '../../../application/contracts/map-constraints';

interface VectorMapProps {
  readonly heading: string;
  readonly bounds: Bounds;
  readonly layers: ReadonlyArray<{
    readonly layerId: string;
    readonly features: readonly MapFeature[];
  }>;
  readonly height: MapHeight;
  /** Layers drawn as a density glow instead of single dots. */
  readonly heatmapLayerIds?: readonly string[];
  readonly selectedKey: string | null;
  readonly onSelect: ((key: string) => void) | null;
}

const FILL_CLASS = {
  point: 'fill-primary-copy stroke-surface',
  line: 'fill-none',
  area: 'fill-surface',
} as const;
const MAX_ZOOM = 8;
/** Glow radius in view-box units at zoom 1; it shrinks with the zoom so it keeps its size on screen. */
const HEAT_RADIUS = 22;

/** First-party geographic overview. It draws the supplied data without tile, font or telemetry requests. */
export function VectorMap({
  heading,
  bounds,
  layers,
  height,
  heatmapLayerIds = [],
  selectedKey,
  onSelect,
}: VectorMapProps) {
  const t = useTranslations('map');
  const project = vectorProjection(bounds);
  const [zoom, setZoom] = useState(1);
  const features = vectorFeatures(layers);
  const heatId = useId();
  const { keys: heatKeys, points: heatPoints } = vectorHeat(layers, heatmapLayerIds, project);
  const drawFeature = (feature: MapFeature) => (
    <g
      key={feature.key}
      data-feature-key={feature.key}
      className={onSelect === null ? undefined : 'cursor-pointer'}
    >
      {vectorPaths(feature.geometry, project).map((path) => (
        <path
          key={path}
          d={path}
          fillRule="evenodd"
          vectorEffect="non-scaling-stroke"
          className={cn(
            'stroke-copy-muted stroke-1',
            FILL_CLASS[feature.family],
            // A heat point stays a click target but shows only through the glow.
            heatKeys.has(feature.key) && 'fill-transparent stroke-transparent',
            selectedKey === feature.key && 'fill-accent-copy stroke-copy stroke-2',
          )}
        />
      ))}
      {selectedKey === feature.key && <title>{feature.label}</title>}
    </g>
  );
  return (
    <div className={cn('relative', MAP_FRAME_CLASS, MAP_HEIGHT_CLASSES[height])}>
      <div className="absolute start-3 top-3 z-10 flex gap-1 print:hidden">
        <Button
          type="button"
          variant="outline"
          aria-disabled={zoom >= MAX_ZOOM}
          aria-label={t('controls.zoomIn')}
          onClick={() => {
            setZoom(Math.min(MAX_ZOOM, zoom * 2));
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-disabled={zoom <= 1}
          aria-label={t('controls.zoomOut')}
          onClick={() => {
            setZoom(Math.max(1, zoom / 2));
          }}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {/* Every pointer target has the same action through a native, full-size button in the feature list. */}
      <svg
        viewBox={vectorViewBox(
          zoom,
          features.find((feature) => feature.key === selectedKey),
          project,
        )}
        className="size-full"
        role="img"
        aria-label={t('canvas.label', { heading })}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          const key = target.closest('[data-feature-key]')?.getAttribute('data-feature-key');
          if (key !== undefined && key !== null) {
            onSelect?.(key);
          }
        }}
      >
        <title>{t('canvas.vectorDescription')}</title>
        {heatPoints.length > 0 && (
          <defs>
            <radialGradient id={heatId} className="text-primary-copy">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.45} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </radialGradient>
          </defs>
        )}
        {features.filter((feature) => feature.family === 'area').map(drawFeature)}
        {/* Overlapping glows add up where places cluster; the glow itself is no click target. */}
        <g aria-hidden="true" className="pointer-events-none">
          {heatPoints.map(([x, y], index) => (
            <circle
              // Positions can repeat; the index keeps each glow distinct.
              key={`${String(index)}-${String(x)}-${String(y)}`}
              cx={x}
              cy={y}
              r={HEAT_RADIUS / Math.sqrt(zoom)}
              fill={`url(#${heatId})`}
            />
          ))}
        </g>
        {features.filter((feature) => feature.family !== 'area').map(drawFeature)}
      </svg>
      <p className="absolute end-3 top-3 text-sm text-copy" aria-hidden="true">
        {t('canvas.north')}
      </p>
      <p className="sr-only">{t('canvas.hint')}</p>
      {/* Selection stays in the native button list, avoiding thousands of tiny keyboard targets in the overview. */}
      <span className="sr-only">{t('canvas.vectorSelection')}</span>
    </div>
  );
}
