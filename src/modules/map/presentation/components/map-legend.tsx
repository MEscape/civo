'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useAttributeFormat } from '../hooks/use-attribute-format';
import { useFieldLabel } from '../hooks/use-field-label';
import { OTHER_COLOR_VAR, RANGE_GRADIENT, SERIES_COLOR_VARS } from '../theme/map-palette';

import type {
  ColorEncoding,
  GeometryFamily,
  LayerStyle,
  MapLayer,
} from '../../application/contracts/map-constraints';

export interface MapLegendProps {
  readonly layers: readonly MapLayer[];
  readonly styles: readonly LayerStyle[];
}

const COLOR_OTHER = OTHER_COLOR_VAR;

function slotColor(slot: number): string {
  return SERIES_COLOR_VARS[slot] ?? COLOR_OTHER;
}

/**
 * The swatch repeats the geometry (dot, line, area) so colour is never the
 * only thing that tells entries apart; the label next to it carries the
 * meaning.
 */
function Swatch({ color, family }: { readonly color: string; readonly family: GeometryFamily }) {
  const shape: Record<GeometryFamily, string> = {
    point: 'size-3 rounded-full',
    line: 'h-1 w-4 rounded-full',
    area: 'size-3 rounded-token-sm opacity-60 ring-1 ring-inset ring-border-strong',
  };
  return (
    // The colour comes from the data's encoding, so it cannot be a static class.
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0', shape[family])}
      style={{ backgroundColor: color }}
    />
  );
}

function RangeBar({
  low,
  high,
  label,
}: {
  readonly low: string;
  readonly high: string;
  readonly label: string;
}) {
  const t = useTranslations('map');
  return (
    <div className="space-y-1" role="img" aria-label={label}>
      {/* The gradient is the same pair of theme colours the map interpolates between. */}
      <div
        className="h-2 w-full rounded-full"
        style={{ backgroundImage: RANGE_GRADIENT }}
        aria-hidden="true"
      />
      <div className="flex justify-between text-xs text-copy-muted" aria-hidden="true">
        <span>
          {t('legend.low')}: {low}
        </span>
        <span>
          {t('legend.high')}: {high}
        </span>
      </div>
    </div>
  );
}

function ColorLegend({ style, layer }: { readonly style: LayerStyle; readonly layer: MapLayer }) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const format = useAttributeFormat();
  const family = style.families.includes('point') ? 'point' : (style.families[0] ?? 'point');
  const fixedLabel = (entry: GeometryFamily, count: number): string => {
    switch (entry) {
      case 'point':
        return t('legend.locations', { count });
      case 'line':
        return t('legend.lines', { count });
      case 'area':
        return t('legend.areas', { count });
    }
  };

  const color: ColorEncoding = style.color;
  switch (color.kind) {
    case 'fixed':
      return (
        <ul className="space-y-1">
          {style.families.map((entry) => (
            <li key={entry} className="flex items-center gap-2 text-sm text-copy">
              <Swatch color={slotColor(color.slot)} family={entry} />
              {fixedLabel(
                entry,
                layer.features.filter((feature) => feature.family === entry).length,
              )}
            </li>
          ))}
        </ul>
      );
    case 'categories':
      return (
        <ul className="space-y-1">
          {color.entries.map((entry) => (
            <li key={entry.value} className="flex items-center gap-2 text-sm text-copy">
              <Swatch color={slotColor(entry.slot)} family={family} />
              <span>
                {entry.value === 'true' || entry.value === 'false'
                  ? format(entry.value === 'true')
                  : entry.value}{' '}
                <span className="text-copy-muted">({format(entry.count)})</span>
              </span>
            </li>
          ))}
          {color.otherCount > 0 && (
            <li className="flex items-center gap-2 text-sm text-copy">
              <Swatch color={COLOR_OTHER} family={family} />
              {t('legend.other', { count: color.otherCount })}
            </li>
          )}
        </ul>
      );
    case 'range':
      return (
        <RangeBar
          low={format(color.min)}
          high={format(color.max)}
          label={t('legend.colorRange', {
            field: label(color.field),
            min: format(color.min),
            max: format(color.max),
          })}
        />
      );
  }
}

function SizeLegend({ style }: { readonly style: LayerStyle }) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const format = useAttributeFormat();
  if (style.size.kind === 'fixed') {
    return null;
  }
  const { field, min, max } = style.size;
  const key = style.pointStyle === 'heatmap' ? 'legend.heatmapWeight' : 'legend.sizeRange';
  return (
    <p className="text-xs text-copy-muted">
      {t(key, { field: label(field), min: format(min), max: format(max) })}
    </p>
  );
}

function DensityLegend() {
  const t = useTranslations('map');
  return (
    <div className="space-y-1" role="img" aria-label={t('legend.density')}>
      <div
        className="h-2 w-full rounded-full"
        style={{ backgroundImage: RANGE_GRADIENT }}
        aria-hidden="true"
      />
      <div className="flex justify-between text-xs text-copy-muted" aria-hidden="true">
        <span>{t('legend.densityLow')}</span>
        <span>{t('legend.densityHigh')}</span>
      </div>
    </div>
  );
}

/**
 * Generated from the same `LayerStyle` objects the map is drawn from, so it
 * cannot drift from what the map shows.
 */
export function MapLegend({ layers, styles }: MapLegendProps) {
  const t = useTranslations('map');
  const drawable = styles
    .map((style) => ({
      style,
      layer: layers.find((layer) => layer.id === style.layerId),
    }))
    .filter((entry) => entry.layer !== undefined && entry.layer.features.length > 0);

  if (drawable.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="map-legend-title"
      className="rounded-token border border-border bg-surface p-4"
    >
      <h3 id="map-legend-title" className="mb-3 text-sm font-medium text-copy">
        {t('legend.title')}
      </h3>
      <div className="space-y-4">
        {drawable.map(({ style, layer }) =>
          layer === undefined ? null : (
            <div key={style.layerId} className="space-y-2">
              {drawable.length > 1 && (
                <h4 className="text-xs font-medium uppercase tracking-wide text-copy-muted">
                  {t('legend.layer', { name: style.label })}
                </h4>
              )}
              {style.pointStyle === 'heatmap' && style.families.includes('point') && (
                <DensityLegend />
              )}
              <ColorLegend style={style} layer={layer} />
              <SizeLegend style={style} />
            </div>
          ),
        )}
      </div>
    </section>
  );
}
