'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import type { MapFeature, MapLayer } from '../../application/contracts/map-constraints';

export interface FeatureListProps {
  readonly layers: ReadonlyArray<{
    readonly layer: MapLayer;
    readonly features: readonly MapFeature[];
  }>;
  readonly selectedKey: string | null;
  /** `null`: selecting is disabled for this map, the list is informational. */
  readonly onSelect: ((key: string) => void) | null;
}

const PAGE_SIZE = 50;

/** Short second line: the two attributes people most often scan by. */
function summaryOf(feature: MapFeature): string {
  return [feature.attributes['category'], feature.attributes['status']]
    .filter((value): value is string => typeof value === 'string')
    .join(' · ');
}

function LayerList({
  layer,
  features,
  selectedKey,
  onSelect,
}: {
  readonly layer: MapLayer;
  readonly features: readonly MapFeature[];
  readonly selectedKey: string | null;
  readonly onSelect: FeatureListProps['onSelect'];
}) {
  const t = useTranslations('map');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = features.slice(0, limit);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-copy">
        {t('list.layer', { name: layer.label, count: features.length })}
      </h4>
      <ul className="divide-y divide-border rounded-token border border-border bg-surface">
        {shown.map((feature) => {
          const summary = summaryOf(feature);
          const isSelected = feature.key === selectedKey;
          const content = (
            <>
              <span className="block text-sm text-copy">{feature.label}</span>
              {summary !== '' && <span className="block text-xs text-copy-muted">{summary}</span>}
            </>
          );
          return (
            <li key={feature.key}>
              {onSelect === null ? (
                <div className="px-3 py-2">{content}</div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  aria-pressed={isSelected}
                  aria-label={t('list.select', { name: feature.label })}
                  onClick={() => {
                    onSelect(feature.key);
                  }}
                  className={cn(
                    'h-auto w-full flex-col items-start justify-start whitespace-normal rounded-none px-3 py-2 text-left',
                    isSelected && 'bg-canvas font-medium',
                  )}
                >
                  {content}
                  {isSelected && <span className="sr-only">{t('list.selected')}</span>}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {features.length > limit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLimit(limit + PAGE_SIZE);
          }}
        >
          {t('list.showMore')}
        </Button>
      )}
    </div>
  );
}

/**
 * The map's text alternative: every location that passes the filters, as a
 * list that works with a keyboard and a screen reader. Large layers render
 * in pages so the DOM stays small.
 */
export function FeatureList({ layers, selectedKey, onSelect }: FeatureListProps) {
  const t = useTranslations('map');
  const populated = layers.filter((entry) => entry.features.length > 0);
  const total = populated.reduce((sum, entry) => sum + entry.features.length, 0);

  if (total === 0) {
    return null;
  }

  return (
    <details className="rounded-token border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-copy">
        {t('list.title', { count: total })}
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {populated.map(({ layer, features }) => (
          <LayerList
            key={layer.id}
            layer={layer}
            features={features}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </details>
  );
}
