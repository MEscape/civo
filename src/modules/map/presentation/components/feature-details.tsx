'use client';

import { buttonVariants, Button } from '@components/ui/button';
import { ExternalLink, Close } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useAttributeFormat } from '../hooks/use-attribute-format';
import { useFieldLabel } from '../hooks/use-field-label';

import type { MapFeature } from '../../application/contracts/map-constraints';

export interface FeatureDetailsProps {
  readonly feature: MapFeature;
  readonly onClose: () => void;
}

/** Attributes shown first, in this order; everything else follows in data order. */
const LEADING_ATTRIBUTES = ['status', 'category', 'value', 'observedAt'] as const;

function orderedAttributes(feature: MapFeature): Array<[string, string | number | boolean]> {
  const entries = Object.entries(feature.attributes);
  const leading = LEADING_ATTRIBUTES.flatMap((key) => entries.filter(([name]) => name === key));
  const rest = entries.filter(
    ([name]) => !(LEADING_ATTRIBUTES as readonly string[]).includes(name),
  );
  return [...leading, ...rest];
}

/**
 * What the map knows about one feature, as real text: the selection never
 * lives only on the canvas. A polite live region announces a new selection
 * to screen readers.
 */
export function FeatureDetails({ feature, onClose }: FeatureDetailsProps) {
  const t = useTranslations('map');
  const label = useFieldLabel();
  const format = useAttributeFormat();
  const attributes = orderedAttributes(feature);
  const unit = feature.attributes['unit'];

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes this non-modal panel from any control inside it; the panel itself gains no role
    <aside
      aria-label={t('details.title')}
      aria-live="polite"
      className="rounded-token border border-border bg-surface p-4 shadow-sm"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold text-copy">{feature.label}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t('details.close')}
        >
          <Close aria-hidden="true" />
        </Button>
      </div>
      {feature.description !== undefined && (
        <p className="mt-2 text-sm text-copy-muted">{feature.description}</p>
      )}
      {attributes.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {attributes
            .filter(([key]) => key !== 'unit')
            .map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-copy-muted">{label(key)}</dt>
                <dd className="text-copy">
                  {format(value)}
                  {key === 'value' && typeof unit === 'string' ? ` ${unit}` : ''}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {feature.href !== undefined && (
        <Link
          href={feature.href}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}
          aria-label={t('details.openLink', { name: feature.label })}
        >
          <ExternalLink aria-hidden="true" />
          {feature.label}
        </Link>
      )}
    </aside>
  );
}
