'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface ServiceStepProps {
  readonly services: readonly PublicServiceDto[];
  readonly onSelect: (serviceId: string) => void;
}

/** Above this many services a search box is offered. */
const SEARCH_THRESHOLD = 8;

function groupByCategory(
  services: readonly PublicServiceDto[],
): ReadonlyArray<readonly [string | null, readonly PublicServiceDto[]]> {
  const groups = new Map<string | null, PublicServiceDto[]>();
  for (const service of services) {
    const list = groups.get(service.category);
    if (list === undefined) {
      groups.set(service.category, [service]);
    } else {
      list.push(service);
    }
  }
  // Uncategorised services come last so a category is never hidden below an "other" bucket.
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === b) {
      return 0;
    }
    if (a === null) {
      return 1;
    }
    return b === null ? -1 : a.localeCompare(b);
  });
}

export function ServiceStep({ services, onSelect }: ServiceStepProps) {
  const t = useTranslations('booking');
  const searchId = useId();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return services;
    }
    return services.filter((service) =>
      `${service.name} ${service.description ?? ''} ${service.category ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [services, query]);

  const groups = groupByCategory(visible);

  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('service.intro')}</p>

      {services.length > SEARCH_THRESHOLD && (
        <div className="space-y-1.5">
          <Label htmlFor={searchId}>{t('service.search')}</Label>
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            autoComplete="off"
          />
        </div>
      )}

      {visible.length === 0 && (
        <p
          role="status"
          className="rounded-token border border-border bg-canvas p-4 text-sm text-copy"
        >
          {t('service.noMatch')}
        </p>
      )}

      {groups.map(([category, inGroup]) => (
        <section key={category ?? 'none'} className="space-y-2">
          {category !== null && groups.length > 1 && (
            <h4 className="text-xs uppercase tracking-wide text-copy-muted">{category}</h4>
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {inGroup.map((service) => (
              <li key={service.id}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onSelect(service.id);
                  }}
                  className="h-full w-full flex-col items-start justify-start gap-1 whitespace-normal p-4 text-left"
                >
                  <span className="font-medium text-copy">{service.name}</span>
                  {service.description !== null && (
                    <span className="text-sm text-copy-muted">{service.description}</span>
                  )}
                  <span className="text-xs text-copy-muted">
                    {t('service.duration', { minutes: service.durationMinutes })}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
