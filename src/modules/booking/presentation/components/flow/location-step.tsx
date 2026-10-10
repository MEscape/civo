'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import type { PublicLocationDto } from '../../dto/catalog-dto';

export interface LocationStepProps {
  readonly locations: readonly PublicLocationDto[];
  readonly selectedId: string | null;
  readonly onSelect: (locationId: string) => void;
}

export function LocationStep({ locations, selectedId, onSelect }: LocationStepProps) {
  const t = useTranslations('booking');

  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('location.intro')}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {locations.map((location) => (
          <li key={location.id}>
            <Button
              type="button"
              variant="outline"
              aria-pressed={location.id === selectedId}
              onClick={() => {
                onSelect(location.id);
              }}
              className="h-full w-full flex-col items-start justify-start gap-1 whitespace-normal p-4 text-left aria-pressed:border-primary"
            >
              <span className="font-medium text-copy">{location.name}</span>
              <span className="text-sm text-copy-muted">
                {location.address ?? t('location.virtual')}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
